import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SpecializationsService } from '../specializations/specializations.service.js';
import { isPatientProfileComplete } from '../patients/profile-completeness.js';
import { Role } from '../generated/prisma/enums.js';
import type { User } from '../generated/prisma/client.js';
import { PasswordHasherService } from './password/password-hasher.service.js';
import { isPasswordPolicyValid } from './password/password-policy.js';
import { SessionService, type SessionMeta } from './session/session.service.js';
import type { AuthUser } from './current-user.js';
import type { RegisterPatientDto } from './dto/register-patient.dto.js';
import type { RegisterDoctorDto } from './dto/register-doctor.dto.js';
import type { LoginDto } from './dto/login.dto.js';
import type { ChangePasswordDto } from './dto/change-password.dto.js';
import type { AuthSessionResponseDto } from './dto/auth-session-response.dto.js';
import type { CurrentUserResponseDto } from './dto/current-user-response.dto.js';

const GENERIC_SIGN_IN_ERROR = 'Invalid email or password';

export interface AuthResult {
  token: string;
  response: AuthSessionResponseDto;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionService: SessionService,
    private readonly passwordHasher: PasswordHasherService,
    private readonly specializationsService: SpecializationsService,
  ) {}

  async registerPatient(dto: RegisterPatientDto, meta: SessionMeta): Promise<AuthResult> {
    const email = dto.email.toLowerCase();
    await this.assertEmailAvailable(email);
    const passwordHash = await this.passwordHasher.hash(dto.password);

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { email, passwordHash, role: Role.PATIENT },
      });
      await tx.patientProfile.create({
        data: { userId: created.id, firstName: dto.firstName, lastName: dto.lastName },
      });
      return created;
    });

    return this.startSession(user, meta);
  }

  async registerDoctor(dto: RegisterDoctorDto, meta: SessionMeta): Promise<AuthResult> {
    const email = dto.email.toLowerCase();
    await this.assertEmailAvailable(email);

    const uniqueSpecializationIds = [...new Set(dto.specializationIds)];
    const allValid = await this.specializationsService.areAllValid(uniqueSpecializationIds);
    if (!allValid) {
      throw new BadRequestException('One or more specializations are not in the catalog');
    }

    const existingLicense = await this.prisma.doctorProfile.findUnique({
      where: { licenseNumber: dto.licenseNumber },
    });
    if (existingLicense) {
      throw new ConflictException('License number already registered');
    }

    const passwordHash = await this.passwordHasher.hash(dto.password);

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { email, passwordHash, role: Role.DOCTOR },
      });
      await tx.doctorProfile.create({
        data: {
          userId: created.id,
          firstName: dto.firstName,
          lastName: dto.lastName,
          licenseNumber: dto.licenseNumber,
          specializations: {
            create: uniqueSpecializationIds.map((specializationId) => ({ specializationId })),
          },
        },
      });
      return created;
    });

    return this.startSession(user, meta);
  }

  async login(dto: LoginDto, meta: SessionMeta): Promise<AuthResult> {
    const email = dto.email.toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });

    // Always pays the cost of an argon2 verification, even for an unknown
    // email, so response timing does not reveal whether the account exists.
    const passwordOk = await this.passwordHasher.verifyOrDummy(user?.passwordHash, dto.password);
    if (!user || !passwordOk) {
      throw new UnauthorizedException(GENERIC_SIGN_IN_ERROR);
    }

    if (user.status !== 'ACTIVE') {
      throw new ForbiddenException('This account is not active');
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    return this.startSession(user, meta);
  }

  async logout(currentUser: AuthUser): Promise<void> {
    await this.sessionService.revokeSession(currentUser.sessionId);
  }

  async logoutAll(currentUser: AuthUser): Promise<void> {
    await this.sessionService.revokeAllSessions(currentUser.id);
  }

  async changePassword(currentUser: AuthUser, dto: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: currentUser.id } });

    const currentOk = await this.passwordHasher.verify(user.passwordHash, dto.currentPassword);
    if (!currentOk) {
      throw new ForbiddenException('Current password is incorrect');
    }

    if (!isPasswordPolicyValid(dto.newPassword, user.email)) {
      throw new BadRequestException('New password does not meet the password policy');
    }

    const passwordHash = await this.passwordHasher.hash(dto.newPassword);
    await this.prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    await this.sessionService.revokeAllSessionsExcept(user.id, currentUser.sessionId);
  }

  async me(currentUser: AuthUser): Promise<CurrentUserResponseDto> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: currentUser.id },
      include: { patientProfile: true, doctorProfile: true },
    });

    if (user.role === Role.PATIENT && user.patientProfile) {
      return {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
        displayName: `${user.patientProfile.firstName} ${user.patientProfile.lastName}`,
        profileComplete: isPatientProfileComplete(user.patientProfile),
      };
    }

    if (user.role === Role.DOCTOR && user.doctorProfile) {
      return {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
        displayName: `${user.doctorProfile.firstName} ${user.doctorProfile.lastName}`,
        verificationStatus: user.doctorProfile.verificationStatus,
      };
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      displayName: 'Administrator',
    };
  }

  private async assertEmailAvailable(email: string): Promise<void> {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }
  }

  private async startSession(user: User, meta: SessionMeta): Promise<AuthResult> {
    const { token } = await this.sessionService.createSession(user.id, meta);
    return {
      token,
      response: { id: user.id, email: user.email, role: user.role },
    };
  }
}
