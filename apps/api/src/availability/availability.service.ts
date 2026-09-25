import { BadRequestException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AppointmentStatus } from '../generated/prisma/enums.js';
import { isVisibleDoctor } from '../doctors/doctor-visibility.js';
import { DomainError } from '../common/errors/domain-error.js';
import { ErrorCode } from '../common/errors/error-codes.js';
import { validateSchedule } from './schedule-validator.js';
import { generateSlots } from './slot-generator.js';
import { isBookingContained } from './booking-containment.js';
import type { SaveAvailabilityDto } from './dto/save-availability.dto.js';
import type { CreateTimeOffDto } from './dto/create-time-off.dto.js';
import type { AvailabilityResponseDto } from './dto/availability-response.dto.js';
import type { TimeOffResponseDto } from './dto/availability-response.dto.js';
import type { SlotResponseDto } from './dto/slot-response.dto.js';

const MAX_SLOT_RANGE_DAYS = 31;
const MAX_TIME_OFF_DAYS = 90;

const WITH_PATIENT_NAME = {
  patient: { select: { firstName: true, lastName: true } },
} as const;

type ConflictingAppointment = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  patient: { firstName: string; lastName: string };
};

/**
 * A schedule save or time-off add that would leave one or more `BOOKED`
 * appointments uncovered is rejected with this, listing the affected
 * appointments so the doctor's next step (cancel them first) is obvious —
 * see design.md's "Availability changes".
 */
function scheduleConflictsError(conflicts: ConflictingAppointment[]): DomainError {
  return new DomainError(
    HttpStatus.CONFLICT,
    ErrorCode.SCHEDULE_CONFLICTS_WITH_BOOKINGS,
    'This change conflicts with one or more of your booked appointments.',
    {
      appointments: conflicts.map((appointment) => ({
        id: appointment.id,
        startsAt: appointment.startsAt.toISOString(),
        endsAt: appointment.endsAt.toISOString(),
        patientName: `${appointment.patient.firstName} ${appointment.patient.lastName}`,
      })),
    },
  );
}

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
      const upcoming = await tx.appointment.findMany({
        where: { doctorId, status: AppointmentStatus.BOOKED, startsAt: { gt: new Date() } },
        include: WITH_PATIENT_NAME,
      });
      const conflicts = upcoming.filter(
        (appointment) => !isBookingContained(appointment, dto.rules, dto.timezone),
      );
      if (conflicts.length > 0) {
        throw scheduleConflictsError(conflicts);
      }

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

    const overlapping = await this.prisma.appointment.findMany({
      where: { doctorId, status: AppointmentStatus.BOOKED, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } },
      include: WITH_PATIENT_NAME,
    });
    if (overlapping.length > 0) {
      throw scheduleConflictsError(overlapping);
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

    const profile = await this.prisma.doctorProfile.findUnique({
      where: { userId: doctorId },
      include: { user: { select: { status: true } } },
    });
    // Same 404 for "not found" and "not a doctor visible to this caller", so
    // existence of a pending/rejected/suspended doctor isn't revealed.
    const visible =
      profile &&
      isVisibleDoctor({
        doctorId,
        verificationStatus: profile.verificationStatus,
        accountStatus: profile.user.status,
        callerId: caller.id,
      });
    if (!visible || !profile) {
      throw new NotFoundException('Doctor not found');
    }

    const [rules, exceptions, booked] = await Promise.all([
      this.prisma.availabilityRule.findMany({ where: { doctorId } }),
      this.prisma.availabilityException.findMany({
        where: { doctorId, startsAt: { lt: to }, endsAt: { gt: from } },
      }),
      this.prisma.appointment.findMany({
        where: { doctorId, status: AppointmentStatus.BOOKED, startsAt: { lt: to }, endsAt: { gt: from } },
        select: { startsAt: true, endsAt: true },
      }),
    ]);

    const slots = generateSlots({
      timezone: profile.timezone,
      consultationMinutes: profile.consultationMinutes,
      rules,
      exceptions,
      booked,
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
