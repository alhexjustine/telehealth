import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { PatientProfile } from '../generated/prisma/client.js';
import type { Prisma } from '../generated/prisma/client.js';
import { isPatientProfileComplete } from './profile-completeness.js';
import type { UpdatePatientProfileDto } from './dto/update-patient-profile.dto.js';
import type { PatientProfileResponseDto } from './dto/patient-profile-response.dto.js';

@Injectable()
export class PatientsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOwnProfile(userId: string): Promise<PatientProfileResponseDto> {
    const profile = await this.prisma.patientProfile.findUniqueOrThrow({ where: { userId } });
    return this.toDto(profile);
  }

  async updateOwnProfile(userId: string, dto: UpdatePatientProfileDto): Promise<PatientProfileResponseDto> {
    const data: Prisma.PatientProfileUpdateInput = {};
    if (dto.firstName !== undefined) data.firstName = dto.firstName;
    if (dto.lastName !== undefined) data.lastName = dto.lastName;
    if (dto.birthDate !== undefined) data.birthDate = new Date(`${dto.birthDate}T00:00:00.000Z`);
    if (dto.weightKg !== undefined) data.weightKg = dto.weightKg;
    if (dto.heightCm !== undefined) data.heightCm = dto.heightCm;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.emergencyContactName !== undefined) data.emergencyContactName = dto.emergencyContactName;
    if (dto.emergencyContactPhone !== undefined) data.emergencyContactPhone = dto.emergencyContactPhone;
    if (dto.medicalConditions !== undefined) data.medicalConditions = dto.medicalConditions;
    if (dto.allergies !== undefined) data.allergies = dto.allergies;
    if (dto.currentMedications !== undefined) data.currentMedications = dto.currentMedications;

    const updated = await this.prisma.patientProfile.update({ where: { userId }, data });
    return this.toDto(updated);
  }

  private toDto(profile: PatientProfile): PatientProfileResponseDto {
    return {
      firstName: profile.firstName,
      lastName: profile.lastName,
      birthDate: profile.birthDate ? profile.birthDate.toISOString().slice(0, 10) : null,
      weightKg: profile.weightKg !== null ? Number(profile.weightKg) : null,
      heightCm: profile.heightCm !== null ? Number(profile.heightCm) : null,
      phone: profile.phone,
      emergencyContactName: profile.emergencyContactName,
      emergencyContactPhone: profile.emergencyContactPhone,
      medicalConditions: profile.medicalConditions,
      allergies: profile.allergies,
      currentMedications: profile.currentMedications,
      profileComplete: isPatientProfileComplete(profile),
    };
  }
}
