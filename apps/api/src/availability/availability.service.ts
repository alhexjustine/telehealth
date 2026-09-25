import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { VerificationStatus } from '../generated/prisma/enums.js';
import { validateSchedule } from './schedule-validator.js';
import { generateSlots } from './slot-generator.js';
import type { SaveAvailabilityDto } from './dto/save-availability.dto.js';
import type { CreateTimeOffDto } from './dto/create-time-off.dto.js';
import type { AvailabilityResponseDto } from './dto/availability-response.dto.js';
import type { TimeOffResponseDto } from './dto/availability-response.dto.js';
import type { SlotResponseDto } from './dto/slot-response.dto.js';

const MAX_SLOT_RANGE_DAYS = 31;
const MAX_TIME_OFF_DAYS = 90;

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async getOwnAvailability(doctorId: string): Promise<AvailabilityResponseDto> {
    const [profile, rules, timeOff] = await Promise.all([
      this.prisma.doctorProfile.findUniqueOrThrow({ where: { userId: doctorId } }),
      this.prisma.availabilityRule.findMany({
        where: { doctorId },
        orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }],
      }),
      this.prisma.availabilityException.findMany({
        where: { doctorId, endsAt: { gt: new Date() } },
        orderBy: { startsAt: 'asc' },
      }),
    ]);

    return {
      timezone: profile.timezone,
      rules: rules.map((rule) => ({
        weekday: rule.weekday,
        startMinute: rule.startMinute,
        endMinute: rule.endMinute,
      })),
      timeOff: timeOff.map(toTimeOffDto),
    };
  }

  async saveAvailability(doctorId: string, dto: SaveAvailabilityDto): Promise<AvailabilityResponseDto> {
    const profile = await this.prisma.doctorProfile.findUniqueOrThrow({ where: { userId: doctorId } });

    const errors = validateSchedule(dto, profile.consultationMinutes);
    if (errors.length > 0) {
      throw new BadRequestException({ message: 'Invalid schedule', errors });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.doctorProfile.update({ where: { userId: doctorId }, data: { timezone: dto.timezone } });
      await tx.availabilityRule.deleteMany({ where: { doctorId } });
      if (dto.rules.length > 0) {
        await tx.availabilityRule.createMany({
          data: dto.rules.map((rule) => ({
            doctorId,
            weekday: rule.weekday,
            startMinute: rule.startMinute,
            endMinute: rule.endMinute,
          })),
        });
      }
    });

    return this.getOwnAvailability(doctorId);
  }

  async addTimeOff(doctorId: string, dto: CreateTimeOffDto): Promise<TimeOffResponseDto> {
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    const now = new Date();

    if (endsAt.getTime() <= startsAt.getTime()) {
      throw new BadRequestException('End must be later than start');
    }
    if (endsAt.getTime() <= now.getTime()) {
      throw new BadRequestException('End must be in the future');
    }
    if (endsAt.getTime() - startsAt.getTime() > MAX_TIME_OFF_DAYS * 24 * 60 * 60 * 1000) {
      throw new BadRequestException(`Time off cannot be longer than ${MAX_TIME_OFF_DAYS} days`);
    }

    const created = await this.prisma.availabilityException.create({
      data: { doctorId, startsAt, endsAt, reason: dto.reason ?? null },
    });
    return toTimeOffDto(created);
  }

  async deleteTimeOff(doctorId: string, exceptionId: string): Promise<void> {
    const deleted = await this.prisma.availabilityException.deleteMany({
      where: { id: exceptionId, doctorId },
    });
    if (deleted.count === 0) {
      throw new NotFoundException('Time off not found');
    }
  }

  async getSlots(
    caller: { id: string },
    doctorId: string,
    fromRaw: string,
    toRaw: string,
  ): Promise<SlotResponseDto[]> {
    const from = new Date(fromRaw);
    const to = new Date(toRaw);
    if (to.getTime() <= from.getTime()) {
      throw new BadRequestException('`to` must be after `from`');
    }
    if (to.getTime() - from.getTime() > MAX_SLOT_RANGE_DAYS * 24 * 60 * 60 * 1000) {
      throw new BadRequestException(`Range cannot be longer than ${MAX_SLOT_RANGE_DAYS} days`);
    }

    const profile = await this.prisma.doctorProfile.findUnique({ where: { userId: doctorId } });
    // Same 404 for "not found" and "not a doctor visible to this caller", so
    // existence of a pending/rejected doctor isn't revealed.
    const visible = profile && (profile.verificationStatus === VerificationStatus.APPROVED || doctorId === caller.id);
    if (!visible || !profile) {
      throw new NotFoundException('Doctor not found');
    }

    const [rules, exceptions] = await Promise.all([
      this.prisma.availabilityRule.findMany({ where: { doctorId } }),
      this.prisma.availabilityException.findMany({
        where: { doctorId, startsAt: { lt: to }, endsAt: { gt: from } },
      }),
    ]);

    const slots = generateSlots({
      timezone: profile.timezone,
      consultationMinutes: profile.consultationMinutes,
      rules,
      exceptions,
      from,
      to,
      now: new Date(),
    });

    return slots.map((slot) => ({ start: slot.start.toISOString(), end: slot.end.toISOString() }));
  }
}

function toTimeOffDto(exception: {
  id: string;
  startsAt: Date;
  endsAt: Date;
  reason: string | null;
}): TimeOffResponseDto {
  return {
    id: exception.id,
    startsAt: exception.startsAt.toISOString(),
    endsAt: exception.endsAt.toISOString(),
    reason: exception.reason,
  };
}
