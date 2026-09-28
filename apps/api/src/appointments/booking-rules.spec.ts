import { describe, expect, it, jest } from '@jest/globals';
import { NotFoundException } from '@nestjs/common';
import { BookingRules } from './booking-rules.js';
import { ErrorCode } from '../common/errors/error-codes.js';
import { AccountStatus, VerificationStatus } from '../generated/prisma/enums.js';
import type { Prisma } from '../generated/prisma/client.js';

const COMPLETE_PATIENT_PROFILE = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  birthDate: new Date('1990-01-01'),
  weightKg: 60,
  heightCm: 165,
  phone: '+1-555-0100',
};

const VISIBLE_DOCTOR_PROFILE: {
  userId: string;
  timezone: string;
  consultationMinutes: number;
  verificationStatus: VerificationStatus;
  acceptingBookings: boolean;
  user: { status: AccountStatus };
} = {
  userId: 'doc-1',
  timezone: 'UTC',
  consultationMinutes: 30,
  verificationStatus: VerificationStatus.APPROVED,
  acceptingBookings: true,
  user: { status: AccountStatus.ACTIVE },
};

// A Monday 09:00-12:00 UTC rule, far enough in the future to always be
// "upcoming" and within the booking horizon regardless of when tests run.
function fullDayRule() {
  return [{ weekday: 1, startMinute: 0, endMinute: 24 * 60 }];
}

function nextMonday(hour: number, now = new Date()): Date {
  const date = new Date(now);
  date.setUTCDate(date.getUTCDate() + ((8 - date.getUTCDay()) % 7 || 7));
  date.setUTCHours(hour, 0, 0, 0);
  return date;
}

interface FakeTxOptions {
  patientProfile?: typeof COMPLETE_PATIENT_PROFILE | null;
  doctorProfile?: typeof VISIBLE_DOCTOR_PROFILE | null;
  upcomingCount?: number;
  rules?: { weekday: number; startMinute: number; endMinute: number }[];
  exceptions?: { startsAt: Date; endsAt: Date }[];
  booked?: { startsAt: Date; endsAt: Date }[];
  patientOverlapCount?: number;
}

function fakeTx(options: FakeTxOptions): Prisma.TransactionClient {
  let appointmentCallCount = 0;
  return {
    patientProfile: {
      findUnique: jest.fn(async () =>
        'patientProfile' in options ? options.patientProfile : COMPLETE_PATIENT_PROFILE,
      ),
    },
    doctorProfile: {
      findUnique: jest.fn(async () =>
        'doctorProfile' in options ? options.doctorProfile : VISIBLE_DOCTOR_PROFILE,
      ),
    },
    availabilityRule: {
      findMany: jest.fn(async () => options.rules ?? fullDayRule()),
    },
    availabilityException: {
      findMany: jest.fn(async () => options.exceptions ?? []),
    },
    appointment: {
      // First call (from step 4) returns the upcoming-count; second call
      // (from step 5) returns booked intervals; the count() in step 6 uses a
      // separate mock below since it's a different method.
      count: jest.fn(async () => {
        appointmentCallCount += 1;
        return appointmentCallCount === 1 ? (options.upcomingCount ?? 0) : (options.patientOverlapCount ?? 0);
      }),
      findMany: jest.fn(async () => options.booked ?? []),
    },
  } as unknown as Prisma.TransactionClient;
}

describe('BookingRules.assertBookable', () => {
  it('PROFILE_INCOMPLETE when the patient profile is missing required fields', async () => {
    const rules = new BookingRules();
    const tx = fakeTx({ patientProfile: { ...COMPLETE_PATIENT_PROFILE, phone: '' } as never });

    await expect(
      rules.assertBookable(tx, {
        patientId: 'pat-1',
        doctorId: 'doc-1',
        startsAt: nextMonday(9),
        now: new Date(),
      }),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: ErrorCode.PROFILE_INCOMPLETE }) });
  });

  it('404 when the doctor is not visible (pending)', async () => {
    const rules = new BookingRules();
    const tx = fakeTx({
      doctorProfile: { ...VISIBLE_DOCTOR_PROFILE, verificationStatus: VerificationStatus.PENDING },
    });

    await expect(
      rules.assertBookable(tx, {
        patientId: 'pat-1',
        doctorId: 'doc-1',
        startsAt: nextMonday(9),
        now: new Date(),
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('404 when the doctor does not exist', async () => {
    const rules = new BookingRules();
    const tx = fakeTx({ doctorProfile: null });

    await expect(
      rules.assertBookable(tx, {
        patientId: 'pat-1',
        doctorId: 'doc-1',
        startsAt: nextMonday(9),
        now: new Date(),
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('BEYOND_BOOKING_HORIZON when starting more than 60 days out', async () => {
    const rules = new BookingRules();
    const now = new Date('2026-01-01T00:00:00Z');
    const tx = fakeTx({});

    await expect(
      rules.assertBookable(tx, {
        patientId: 'pat-1',
        doctorId: 'doc-1',
        startsAt: new Date(now.getTime() + 61 * 24 * 60 * 60 * 1000),
        now,
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: ErrorCode.BEYOND_BOOKING_HORIZON }),
    });
  });

  it('BOOKING_LIMIT_REACHED at 5 upcoming appointments', async () => {
    const rules = new BookingRules();
    const tx = fakeTx({ upcomingCount: 5 });

    await expect(
      rules.assertBookable(tx, {
        patientId: 'pat-1',
        doctorId: 'doc-1',
        startsAt: nextMonday(9),
        now: new Date(),
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: ErrorCode.BOOKING_LIMIT_REACHED }),
    });
  });

  it('SLOT_UNAVAILABLE when the start is not an available slot', async () => {
    const rules = new BookingRules();
    // No rules at all: generateSlots never returns anything.
    const tx = fakeTx({ rules: [] });

    await expect(
      rules.assertBookable(tx, {
        patientId: 'pat-1',
        doctorId: 'doc-1',
        startsAt: nextMonday(9),
        now: new Date(),
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: ErrorCode.SLOT_UNAVAILABLE }),
    });
  });

  it('PATIENT_CONFLICT when the patient already has an overlapping booking', async () => {
    const rules = new BookingRules();
    const tx = fakeTx({ patientOverlapCount: 1 });

    await expect(
      rules.assertBookable(tx, {
        patientId: 'pat-1',
        doctorId: 'doc-1',
        startsAt: nextMonday(9),
        now: new Date(),
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: ErrorCode.PATIENT_CONFLICT }),
    });
  });

  it('succeeds and returns endsAt when every rule passes', async () => {
    const rules = new BookingRules();
    const tx = fakeTx({});
    const startsAt = nextMonday(9);

    const result = await rules.assertBookable(tx, {
      patientId: 'pat-1',
      doctorId: 'doc-1',
      startsAt,
      now: new Date(),
    });

    expect(result.endsAt.getTime()).toBe(startsAt.getTime() + 30 * 60_000);
  });

  it('excludeAppointmentId is passed through so a reschedule ignores the original', async () => {
    const rules = new BookingRules();
    const tx = fakeTx({});
    const findManySpy = (tx.appointment as unknown as { findMany: jest.Mock }).findMany;

    await rules.assertBookable(tx, {
      patientId: 'pat-1',
      doctorId: 'doc-1',
      startsAt: nextMonday(9),
      now: new Date(),
      excludeAppointmentId: 'apt-original',
    });

    const callArgs = findManySpy.mock.calls[0]?.[0] as { where: { id?: { not?: string } } };
    expect(callArgs.where.id).toEqual({ not: 'apt-original' });
  });
});
