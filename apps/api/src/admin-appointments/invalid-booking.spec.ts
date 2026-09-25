import { describe, expect, it } from '@jest/globals';
import { computeInvalidBookingFlags, isDoctorUnavailable, isNotCompleted } from './invalid-booking.js';
import { AccountStatus, AppointmentStatus, VerificationStatus } from '../generated/prisma/enums.js';

const NOW = new Date('2026-06-15T12:00:00.000Z');
const approvedActiveDoctor = { verificationStatus: VerificationStatus.APPROVED, accountStatus: AccountStatus.ACTIVE };

describe('isNotCompleted', () => {
  it('Past appointment never completed', () => {
    const appointment = {
      status: AppointmentStatus.BOOKED,
      endsAt: new Date(NOW.getTime() - 2 * 3_600_000),
    };
    expect(isNotCompleted(appointment, NOW)).toBe(true);
  });

  it('A completed appointment is never flagged', () => {
    const appointment = { status: AppointmentStatus.COMPLETED, endsAt: new Date(NOW.getTime() - 2 * 3_600_000) };
    expect(isNotCompleted(appointment, NOW)).toBe(false);
  });

  it('Still within the 30-minute grace period is not flagged', () => {
    const appointment = { status: AppointmentStatus.BOOKED, endsAt: new Date(NOW.getTime() - 10 * 60_000) };
    expect(isNotCompleted(appointment, NOW)).toBe(false);
  });

  it('An upcoming booked appointment is not flagged', () => {
    const appointment = { status: AppointmentStatus.BOOKED, endsAt: new Date(NOW.getTime() + 3_600_000) };
    expect(isNotCompleted(appointment, NOW)).toBe(false);
  });
});

describe('isDoctorUnavailable', () => {
  it('Upcoming appointment with a rejected doctor', () => {
    const appointment = {
      status: AppointmentStatus.BOOKED,
      startsAt: new Date(NOW.getTime() + 3_600_000),
      doctor: { verificationStatus: VerificationStatus.REJECTED, accountStatus: AccountStatus.ACTIVE },
    };
    expect(isDoctorUnavailable(appointment, NOW)).toBe(true);
  });

  it('Upcoming appointment with a suspended doctor account', () => {
    const appointment = {
      status: AppointmentStatus.BOOKED,
      startsAt: new Date(NOW.getTime() + 3_600_000),
      doctor: { verificationStatus: VerificationStatus.APPROVED, accountStatus: AccountStatus.SUSPENDED },
    };
    expect(isDoctorUnavailable(appointment, NOW)).toBe(true);
  });

  it('Upcoming appointment with an approved, active doctor is not flagged', () => {
    const appointment = {
      status: AppointmentStatus.BOOKED,
      startsAt: new Date(NOW.getTime() + 3_600_000),
      doctor: approvedActiveDoctor,
    };
    expect(isDoctorUnavailable(appointment, NOW)).toBe(false);
  });

  it('An already-started appointment is not flagged, even with an unavailable doctor', () => {
    const appointment = {
      status: AppointmentStatus.BOOKED,
      startsAt: new Date(NOW.getTime() - 3_600_000),
      doctor: { verificationStatus: VerificationStatus.REJECTED, accountStatus: AccountStatus.ACTIVE },
    };
    expect(isDoctorUnavailable(appointment, NOW)).toBe(false);
  });
});

describe('computeInvalidBookingFlags', () => {
  it('A valid, upcoming, approved-doctor appointment has no flags', () => {
    const appointment = {
      status: AppointmentStatus.BOOKED,
      startsAt: new Date(NOW.getTime() + 3_600_000),
      endsAt: new Date(NOW.getTime() + 2 * 3_600_000),
      doctor: approvedActiveDoctor,
    };
    expect(computeInvalidBookingFlags(appointment, NOW)).toEqual([]);
  });
});
