import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SpecializationsService } from '../specializations/specializations.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { VerificationStatus } from '../generated/prisma/enums.js';
import { requiresReReview } from './doctor-re-review.js';
import type { UpdateDoctorProfileDto } from './dto/update-doctor-profile.dto.js';
import type { DoctorProfileResponseDto } from './dto/doctor-profile-response.dto.js';

type DoctorProfileWithSpecializations = Prisma.DoctorProfileGetPayload<{
  include: { specializations: { include: { specialization: true } } };
}>;

const WITH_SPECIALIZATIONS = {
  specializations: { include: { specialization: true } },
} satisfies Prisma.DoctorProfileInclude;

@Injectable()
export class DoctorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly specializationsService: SpecializationsService,
  ) {}

  async getOwnProfile(userId: string): Promise<DoctorProfileResponseDto> {
    const profile = await this.prisma.doctorProfile.findUniqueOrThrow({
      where: { userId },
      include: WITH_SPECIALIZATIONS,
    });
    return this.toDto(profile);
  }

  async updateOwnProfile(userId: string, dto: UpdateDoctorProfileDto): Promise<DoctorProfileResponseDto> {
    const current = await this.prisma.doctorProfile.findUniqueOrThrow({
      where: { userId },
      include: WITH_SPECIALIZATIONS,
    });

    if (dto.licenseNumber !== undefined) {
      const existing = await this.prisma.doctorProfile.findUnique({
        where: { licenseNumber: dto.licenseNumber },
      });
      if (existing && existing.userId !== userId) {
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
      // Full replace: doctors submit the complete desired set, not a delta.
      data.specializations = {
        deleteMany: {},
        create: specializationIds.map((specializationId) => ({ specializationId })),
      };
    }

    if (
      requiresReReview(
        {
          verificationStatus: current.verificationStatus,
          licenseNumber: current.licenseNumber,
          specializationIds: current.specializations.map((link) => link.specializationId),
        },
        { licenseNumber: dto.licenseNumber, specializationIds },
      )
    ) {
      data.verificationStatus = VerificationStatus.PENDING;
      data.reviewNote = null;
    }

    const updated = await this.prisma.doctorProfile.update({
      where: { userId },
      data,
      include: WITH_SPECIALIZATIONS,
    });
    return this.toDto(updated);
  }

  private toDto(profile: DoctorProfileWithSpecializations): DoctorProfileResponseDto {
    return {
      firstName: profile.firstName,
      lastName: profile.lastName,
      bio: profile.bio,
      yearsOfExperience: profile.yearsOfExperience,
      licenseNumber: profile.licenseNumber,
      consultationMinutes: profile.consultationMinutes,
      verificationStatus: profile.verificationStatus,
      reviewNote: profile.reviewNote,
      specializations: profile.specializations.map((link) => ({
        id: link.specialization.id,
        name: link.specialization.name,
      })),
    };
  }
}
