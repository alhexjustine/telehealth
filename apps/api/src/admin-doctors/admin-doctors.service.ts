import { BadRequestException, ConflictException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SpecializationsService } from '../specializations/specializations.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { withNotifications } from '../notifications/with-notifications.js';
import { AuditService } from '../audit/audit.service.js';
import { AuditEntityType } from '../audit/audit-entity-type.js';
import { diffFields } from '../audit/diff-fields.js';
import { DomainError } from '../common/errors/domain-error.js';
import { ErrorCode } from '../common/errors/error-codes.js';
import type { Prisma } from '../generated/prisma/client.js';
import { AuditAction, NotificationType, VerificationStatus } from '../generated/prisma/enums.js';
import type { UpdateDoctorProfileDto } from '../doctors/dto/update-doctor-profile.dto.js';
import type { AdminDoctorListQueryDto } from './dto/admin-doctor-list-query.dto.js';
import type { ApproveDoctorDto, RejectDoctorDto } from './dto/decide-doctor-review.dto.js';
import type {
  AdminDoctorListResponseDto,
  AdminDoctorProfileDto,
} from './dto/admin-doctor-response.dto.js';

const WITH_RELATIONS = {
  specializations: { include: { specialization: true } },
  user: { select: { email: true, status: true, statusReason: true } },
} satisfies Prisma.DoctorProfileInclude;

type DoctorProfileWithRelations = Prisma.DoctorProfileGetPayload<{ include: typeof WITH_RELATIONS }>;

/** Fields `diffFields` may include for a `DOCTOR_PROFILE_UPDATED` audit entry — never `reviewNote` or account fields. */
const PROFILE_AUDIT_FIELDS = [
  'firstName',
  'lastName',
  'bio',
  'yearsOfExperience',
  'licenseNumber',
  'consultationMinutes',
  'specializationIds',
] as const;

@Injectable()
export class AdminDoctorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly specializationsService: SpecializationsService,
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService,
  ) {}

  async list(query: AdminDoctorListQueryDto): Promise<AdminDoctorListResponseDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.DoctorProfileWhereInput = { verificationStatus: query.verification ?? VerificationStatus.PENDING };

    const [items, total] = await Promise.all([
      this.prisma.doctorProfile.findMany({
        where,
        include: WITH_RELATIONS,
        orderBy: { updatedAt: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.doctorProfile.count({ where }),
    ]);

    return {
      items: items.map((doctor) => ({
        id: doctor.userId,
        displayName: `${doctor.firstName} ${doctor.lastName}`,
        email: doctor.user.email,
        licenseNumber: doctor.licenseNumber,
        verificationStatus: doctor.verificationStatus,
        accountStatus: doctor.user.status,
        specializations: doctor.specializations.map((link) => ({
          id: link.specialization.id,
          name: link.specialization.name,
        })),
        updatedAt: doctor.updatedAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    };
  }

  async detail(doctorId: string): Promise<AdminDoctorProfileDto> {
    const doctor = await this.prisma.doctorProfile.findUnique({ where: { userId: doctorId }, include: WITH_RELATIONS });
    if (!doctor) throw new NotFoundException('Doctor not found');
    return this.toProfileDto(doctor);
  }

  async approve(adminId: string, doctorId: string, dto: ApproveDoctorDto): Promise<AdminDoctorProfileDto> {
    return this.decide(adminId, doctorId, {
      status: VerificationStatus.APPROVED,
      note: dto.note?.trim() || null,
      action: AuditAction.DOCTOR_APPROVED,
      notification: {
        type: NotificationType.PROFILE_APPROVED,
        title: 'Profile approved',
        body: 'Your profile is now visible to patients.',
      },
    });
  }

  async reject(adminId: string, doctorId: string, dto: RejectDoctorDto): Promise<AdminDoctorProfileDto> {
    const note = dto.note.trim();
    return this.decide(adminId, doctorId, {
      status: VerificationStatus.REJECTED,
      note,
      action: AuditAction.DOCTOR_REJECTED,
      notification: {
        type: NotificationType.PROFILE_REJECTED,
        title: 'Profile not approved',
        body: note,
      },
    });
  }

  /**
   * Reuses the doctor's own profile-update validation (duplicate license,
   * specialization catalog membership) but never touches `verificationStatus`
   * or `reviewNote` — see the `admin-doctor-review` spec's "Admin edits to
   * doctor profiles". Audited with the same allow-list the doctor's own
   * update would use, so no clinical or account field can appear.
   */
  async update(adminId: string, doctorId: string, dto: UpdateDoctorProfileDto): Promise<AdminDoctorProfileDto> {
    const current = await this.prisma.doctorProfile.findUnique({ where: { userId: doctorId }, include: WITH_RELATIONS });
    if (!current) throw new NotFoundException('Doctor not found');

    if (dto.licenseNumber !== undefined) {
      const existing = await this.prisma.doctorProfile.findUnique({ where: { licenseNumber: dto.licenseNumber } });
      if (existing && existing.userId !== doctorId) {
        throw new ConflictException('License number already registered');
      }
    }

    let specializationIds: string[] | undefined;
    if (dto.specializationIds !== undefined) {
      specializationIds = [...new Set(dto.specializationIds)];
      const allValid = await this.specializationsService.areAllValid(specializationIds);
      if (!allValid) {
        throw new BadRequestException('One or more specializations are not in the catalog');
      }
    }

    const data: Prisma.DoctorProfileUpdateInput = {};
    if (dto.firstName !== undefined) data.firstName = dto.firstName;
    if (dto.lastName !== undefined) data.lastName = dto.lastName;
    if (dto.bio !== undefined) data.bio = dto.bio;
    if (dto.yearsOfExperience !== undefined) data.yearsOfExperience = dto.yearsOfExperience;
    if (dto.licenseNumber !== undefined) data.licenseNumber = dto.licenseNumber;
    if (dto.consultationMinutes !== undefined) data.consultationMinutes = dto.consultationMinutes;
    if (specializationIds) {
      data.specializations = { deleteMany: {}, create: specializationIds.map((specializationId) => ({ specializationId })) };
    }

    const before = {
      firstName: current.firstName,
      lastName: current.lastName,
      bio: current.bio,
      yearsOfExperience: current.yearsOfExperience,
      licenseNumber: current.licenseNumber,
      consultationMinutes: current.consultationMinutes,
      specializationIds: current.specializations.map((link) => link.specializationId).sort(),
    };

    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.doctorProfile.update({ where: { userId: doctorId }, data, include: WITH_RELATIONS });

      const after = {
        firstName: saved.firstName,
        lastName: saved.lastName,
        bio: saved.bio,
        yearsOfExperience: saved.yearsOfExperience,
        licenseNumber: saved.licenseNumber,
        consultationMinutes: saved.consultationMinutes,
        specializationIds: saved.specializations.map((link) => link.specializationId).sort(),
      };
      const diff = diffFields(before, after, PROFILE_AUDIT_FIELDS);
      await this.auditService.record(tx, {
        actorId: adminId,
        action: AuditAction.DOCTOR_PROFILE_UPDATED,
        entityType: AuditEntityType.DOCTOR_PROFILE,
        entityId: doctorId,
        before: diff.before,
        after: diff.after,
      });

      return saved;
    });

    return this.toProfileDto(updated);
  }

  private async decide(
    adminId: string,
    doctorId: string,
    params: {
      status: VerificationStatus;
      note: string | null;
      action: typeof AuditAction.DOCTOR_APPROVED | typeof AuditAction.DOCTOR_REJECTED;
      notification: { type: NotificationType; title: string; body: string };
    },
  ): Promise<AdminDoctorProfileDto> {
    const { result, notifications } = await withNotifications(
      this.prisma,
      this.notificationsService,
      async (tx, notify) => {
        const doctor = await tx.doctorProfile.findUnique({ where: { userId: doctorId }, include: WITH_RELATIONS });
        if (!doctor) throw new NotFoundException('Doctor not found');
        if (doctor.verificationStatus === params.status) {
          throw new DomainError(HttpStatus.CONFLICT, ErrorCode.STATUS_UNCHANGED, 'The doctor already has this verification status.');
        }
        if (params.status === VerificationStatus.REJECTED && doctor.verificationStatus === VerificationStatus.APPROVED) {
          throw new DomainError(
            HttpStatus.CONFLICT,
            ErrorCode.INVALID_VERIFICATION_TRANSITION,
            'An approved doctor cannot be rejected; suspend or deactivate the account instead.',
          );
        }

        const before = { verificationStatus: doctor.verificationStatus, reviewNote: doctor.reviewNote };
        const updated = await tx.doctorProfile.update({
          where: { userId: doctorId },
          data: { verificationStatus: params.status, reviewNote: params.note },
          include: WITH_RELATIONS,
        });

        await notify([
          {
            userId: doctorId,
            type: params.notification.type,
            title: params.notification.title,
            body: params.notification.body,
            data: { reviewNote: params.note },
          },
        ]);

        const diff = diffFields(before, { verificationStatus: updated.verificationStatus, reviewNote: updated.reviewNote }, [
          'verificationStatus',
          'reviewNote',
        ]);
        await this.auditService.record(tx, {
          actorId: adminId,
          action: params.action,
          entityType: AuditEntityType.DOCTOR_PROFILE,
          entityId: doctorId,
          reason: params.note,
          before: diff.before,
          after: diff.after,
        });

        return updated;
      },
    );

    await this.notificationsService.publish(notifications);
    return this.toProfileDto(result);
  }

  private toProfileDto(doctor: DoctorProfileWithRelations): AdminDoctorProfileDto {
    return {
      id: doctor.userId,
      email: doctor.user.email,
      firstName: doctor.firstName,
      lastName: doctor.lastName,
      bio: doctor.bio,
      yearsOfExperience: doctor.yearsOfExperience,
      licenseNumber: doctor.licenseNumber,
      consultationMinutes: doctor.consultationMinutes,
      verificationStatus: doctor.verificationStatus,
      reviewNote: doctor.reviewNote,
      accountStatus: doctor.user.status,
      accountStatusReason: doctor.user.statusReason,
      specializations: doctor.specializations.map((link) => ({ id: link.specialization.id, name: link.specialization.name })),
      updatedAt: doctor.updatedAt.toISOString(),
    };
  }
}
