import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { NextSlotService } from '../availability/next-slot.service.js';
import { visibleDoctorWhere } from '../doctors/doctor-visibility.js';
import { match, type MatchingCatalog, type MatchingDoctor, type MatchingSymptom } from './matching-engine.js';
import { ageAt } from './age.js';
import type { MatchingRequestDto } from './dto/matching-request.dto.js';
import type { MatchingResponseDto } from './dto/matching-response.dto.js';

const EMERGENCY_MESSAGE =
  'This may be a medical emergency. Contact your local emergency services immediately.';
const MATCHING_HORIZON_DAYS = 14;

@Injectable()
export class MatchingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly nextSlotService: NextSlotService,
  ) {}

  async match(patientId: string, dto: MatchingRequestDto): Promise<MatchingResponseDto> {
    const symptomIds = dto.symptomIds ?? [];
    const description = dto.descriptionText?.trim();
    if (symptomIds.length === 0 && !description) {
      throw new BadRequestException('Provide at least one symptom or a description');
    }

    const catalog = await this.loadCatalog();
    const catalogIds = new Set(catalog.symptoms.map((s) => s.id));
    for (const id of symptomIds) {
      if (!catalogIds.has(id)) {
        throw new BadRequestException(`Unknown symptom: ${id}`);
      }
    }

    const now = new Date();
    const [patientProfile, doctors] = await Promise.all([
      this.prisma.patientProfile.findUnique({ where: { userId: patientId } }),
      this.loadDoctors(now),
    ]);
    const patientAge = patientProfile?.birthDate ? ageAt(patientProfile.birthDate, now) : null;

    const result = match({
      symptomIds,
      descriptionText: dto.descriptionText,
      catalog,
      patientAge,
      doctors,
    });

    return {
      urgent: result.urgent,
      emergencyMessage: result.urgent
        ? `${EMERGENCY_MESSAGE} Symptoms of concern: ${result.redFlags.map((r) => r.symptomName).join(', ')}.`
        : null,
      redFlags: result.redFlags,
      matchedSymptoms: result.matchedSymptoms,
      specializations: result.specializations,
      doctors: result.doctors.map((d) => ({
        ...d,
        nextAvailableSlot: d.nextAvailableSlot ? d.nextAvailableSlot.toISOString() : null,
      })),
      ageUnknown: patientAge === null,
    };
  }

  private async loadCatalog(): Promise<MatchingCatalog> {
    const [symptoms, generalPractice, pediatrics] = await Promise.all([
      this.prisma.symptom.findMany({
        include: { specializations: { include: { specialization: true } } },
      }),
      this.prisma.specialization.findUniqueOrThrow({ where: { slug: 'general-practice' } }),
      this.prisma.specialization.findUniqueOrThrow({ where: { slug: 'pediatrics' } }),
    ]);

    const catalogSymptoms: MatchingSymptom[] = symptoms.map((symptom) => ({
      id: symptom.id,
      name: symptom.name,
      keywords: symptom.keywords,
      isRedFlag: symptom.isRedFlag,
      links: symptom.specializations.map((link) => ({
        specializationId: link.specializationId,
        specializationName: link.specialization.name,
        weight: link.weight,
      })),
    }));

    return {
      symptoms: catalogSymptoms,
      generalPractice: { specializationId: generalPractice.id, specializationName: generalPractice.name },
      pediatrics: { specializationId: pediatrics.id, specializationName: pediatrics.name },
    };
  }

  private async loadDoctors(now: Date): Promise<MatchingDoctor[]> {
    const profiles = await this.prisma.doctorProfile.findMany({
      where: visibleDoctorWhere(),
      include: { specializations: true },
    });

    const nextSlots = await this.nextSlotService.nextSlotFor(
      profiles.map((p) => ({ userId: p.userId, timezone: p.timezone, consultationMinutes: p.consultationMinutes })),
      now,
      MATCHING_HORIZON_DAYS,
    );

    return profiles.map((profile) => ({
      id: profile.userId,
      displayName: `${profile.firstName} ${profile.lastName}`,
      specializationIds: profile.specializations.map((s) => s.specializationId),
      nextAvailableSlot: nextSlots.get(profile.userId) ?? null,
    }));
  }
}
