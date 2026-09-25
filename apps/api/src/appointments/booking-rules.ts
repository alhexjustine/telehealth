import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { AppointmentStatus } from '../generated/prisma/enums.js';
import { isVisibleDoctor } from '../doctors/doctor-visibility.js';
import { isPatientProfileComplete } from '../patients/profile-completeness.js';
import { generateSlots } from '../availability/slot-generator.js';
import { DomainError } from '../common/errors/domain-error.js';
import { ErrorCode } from '../common/errors/error-codes.js';
import { BOOKING_HORIZON_DAYS, MAX_UPCOMING_PER_PATIENT } from './booking.constants.js';

export interface AssertBookableParams {
  patientId: string;
  doctorId: string;
  startsAt: Date;
  now: Date;
  /** Excluded from the patient's booking-limit count and from overlap checks: the appointment being rescheduled. */
  excludeAppointmentId?: string;
}

export interface AssertBookableResult {
  endsAt: Date;
}

/**
 * The single source of truth for whether a patient may book (or reschedule
 * into) a given doctor/start, shared by book and reschedule so the rules
 * can't diverge — see design.md's "Booking rules as one module". Runs the
 * checks in a fixed order and throws the first one that fails; the caller
 * (inside a transaction) still relies on the database exclusion constraints
 * as the final guard against a concurrent race between this check and the
 * insert (see design.md's "No double-booking under concurrency").
 */
@Injectable()
export class BookingRules {
  async assertBookable(
    tx: Prisma.TransactionClient,
    params: AssertBookableParams,
  ): Promise<AssertBookableResult> {
    // 1. Profile complete.
    const patientProfile = await tx.patientProfile.findUnique({ where: { userId: params.patientId } });
    if (!patientProfile || !isPatientProfileComplete(patientProfile)) {
      throw new DomainError(
        HttpStatus.CONFLICT,
        ErrorCode.PROFILE_INCOMPLETE,
        'Complete your profile before booking an appointment.',
      );
    }

    // 2. Doctor visible.
    const doctorProfile = await tx.doctorProfile.findUnique({
      where: { userId: params.doctorId },
      include: { user: { select: { status: true } } },
    });
    const visible =
      doctorProfile &&
      isVisibleDoctor({
        doctorId: params.doctorId,
        verificationStatus: doctorProfile.verificationStatus,
        accountStatus: doctorProfile.user.status,
        callerId: params.patientId,
      });
    if (!doctorProfile || !visible) {
      throw new NotFoundException('Doctor not found');
    }

    // 3. Within the booking horizon.
    const horizonMs = params.now.getTime() + BOOKING_HORIZON_DAYS * 24 * 60 * 60 * 1000;
    if (params.startsAt.getTime() > horizonMs) {
      throw new DomainError(
        HttpStatus.CONFLICT,
        ErrorCode.BEYOND_BOOKING_HORIZON,
        `Appointments can only be booked up to ${BOOKING_HORIZON_DAYS} days ahead.`,
      );
    }

    // 4. Under the patient's upcoming-appointment limit.
    const upcomingCount = await tx.appointment.count({
      where: {
        patientId: params.patientId,
        status: AppointmentStatus.BOOKED,
        endsAt: { gt: params.now },
        ...excludeFilter(params.excludeAppointmentId),
      },
    });
    if (upcomingCount >= MAX_UPCOMING_PER_PATIENT) {
      throw new DomainError(
        HttpStatus.CONFLICT,
        ErrorCode.BOOKING_LIMIT_REACHED,
        `You can have at most ${MAX_UPCOMING_PER_PATIENT} upcoming appointments.`,
      );
    }

    const endsAt = new Date(params.startsAt.getTime() + doctorProfile.consultationMinutes * 60_000);

    // 5. Exactly matches a currently available slot.
    const [rules, exceptions, booked] = await Promise.all([
      tx.availabilityRule.findMany({ where: { doctorId: params.doctorId } }),
      tx.availabilityException.findMany({
        where: { doctorId: params.doctorId, startsAt: { lt: endsAt }, endsAt: { gt: params.startsAt } },
      }),
      tx.appointment.findMany({
        where: {
          doctorId: params.doctorId,
          status: AppointmentStatus.BOOKED,
          startsAt: { lt: endsAt },
          endsAt: { gt: params.startsAt },
          ...excludeFilter(params.excludeAppointmentId),
        },
        select: { startsAt: true, endsAt: true },
      }),
    ]);

    const slots = generateSlots({
      timezone: doctorProfile.timezone,
      consultationMinutes: doctorProfile.consultationMinutes,
      rules,
      exceptions,
      booked,
      from: params.startsAt,
      to: endsAt,
      now: params.now,
    });
    const isAvailableSlot = slots.some((slot) => slot.start.getTime() === params.startsAt.getTime());
    if (!isAvailableSlot) {
      throw new DomainError(HttpStatus.CONFLICT, ErrorCode.SLOT_UNAVAILABLE, 'That slot is no longer available.');
    }

    // 6. No overlap with the patient's own other booked appointments.
    const patientOverlapCount = await tx.appointment.count({
      where: {
        patientId: params.patientId,
        status: AppointmentStatus.BOOKED,
        startsAt: { lt: endsAt },
        endsAt: { gt: params.startsAt },
        ...excludeFilter(params.excludeAppointmentId),
      },
    });
    if (patientOverlapCount > 0) {
      throw new DomainError(
        HttpStatus.CONFLICT,
        ErrorCode.PATIENT_CONFLICT,
        'This overlaps another of your own appointments.',
      );
    }

    return { endsAt };
  }
}

function excludeFilter(excludeAppointmentId: string | undefined): Prisma.AppointmentWhereInput {
  return excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {};
}
