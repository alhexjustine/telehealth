import type { Prisma } from '../generated/prisma/client.js';
import { AccountStatus, AppointmentStatus, VerificationStatus } from '../generated/prisma/enums.js';

export const InvalidBookingFlag = {
  /** A `BOOKED` appointment that ended more than 30 minutes ago and was never completed. */
  NOT_COMPLETED: 'NOT_COMPLETED',
  /** An upcoming `BOOKED` appointment whose doctor is no longer visible to patients. */
  DOCTOR_UNAVAILABLE: 'DOCTOR_UNAVAILABLE',
} as const;

export type InvalidBookingFlag = (typeof InvalidBookingFlag)[keyof typeof InvalidBookingFlag];

/** How long after `endsAt` a `BOOKED` appointment is given to be completed before it's flagged stale. */
export const NOT_COMPLETED_GRACE_MINUTES = 30;
const NOT_COMPLETED_GRACE_MS = NOT_COMPLETED_GRACE_MINUTES * 60_000;

export interface FlaggableAppointment {
  status: AppointmentStatus;
  startsAt: Date;
  endsAt: Date;
  doctor: { verificationStatus: VerificationStatus; accountStatus: AccountStatus };
}

/**
 * The two invalid-booking rules (`admin-appointments` spec's "Invalid
 * booking detection"), each expressed twice — a pure predicate for unit
 * tests and in-memory DTO building, and a matching Prisma `where` builder so
 * the appointment list's `invalidOnly` filter and the dashboard's count use
 * the exact same rule at query time (see design.md's "Invalid-booking
 * flags"). The two must be kept in sync by hand; the unit tests below pin
 * the predicate side, and the e2e appointment-oversight tests pin the
 * `where`-builder side against a real database.
 */
export function isNotCompleted(appointment: Pick<FlaggableAppointment, 'status' | 'endsAt'>, now: Date): boolean {
  return (
    appointment.status === AppointmentStatus.BOOKED &&
    appointment.endsAt.getTime() < now.getTime() - NOT_COMPLETED_GRACE_MS
  );
}

export function isDoctorUnavailable(appointment: Pick<FlaggableAppointment, 'status' | 'startsAt' | 'doctor'>, now: Date): boolean {
  if (appointment.status !== AppointmentStatus.BOOKED || appointment.startsAt.getTime() <= now.getTime()) {
    return false;
  }
  return (
    appointment.doctor.verificationStatus !== VerificationStatus.APPROVED ||
    appointment.doctor.accountStatus !== AccountStatus.ACTIVE
  );
}

export function computeInvalidBookingFlags(appointment: FlaggableAppointment, now: Date): InvalidBookingFlag[] {
  const flags: InvalidBookingFlag[] = [];
  if (isNotCompleted(appointment, now)) flags.push(InvalidBookingFlag.NOT_COMPLETED);
  if (isDoctorUnavailable(appointment, now)) flags.push(InvalidBookingFlag.DOCTOR_UNAVAILABLE);
  return flags;
}

export function notCompletedWhere(now: Date): Prisma.AppointmentWhereInput {
  return {
    status: AppointmentStatus.BOOKED,
    endsAt: { lt: new Date(now.getTime() - NOT_COMPLETED_GRACE_MS) },
  };
}

export function doctorUnavailableWhere(now: Date): Prisma.AppointmentWhereInput {
  return {
    status: AppointmentStatus.BOOKED,
    startsAt: { gt: now },
    doctor: {
      is: {
        OR: [
          { verificationStatus: { not: VerificationStatus.APPROVED } },
          { user: { is: { status: { not: AccountStatus.ACTIVE } } } },
        ],
      },
    },
  };
}

export function invalidBookingWhere(now: Date): Prisma.AppointmentWhereInput {
  return { OR: [notCompletedWhere(now), doctorUnavailableWhere(now)] };
}
