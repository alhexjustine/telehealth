import { describe, expect, it, jest } from '@jest/globals';
import { NextSlotService } from './next-slot.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';

function fakePrisma(params: {
  rules: { doctorId: string; weekday: number; startMinute: number; endMinute: number }[];
  exceptions?: { doctorId: string; startsAt: Date; endsAt: Date }[];
}): PrismaService {
  return {
    availabilityRule: { findMany: jest.fn(async () => params.rules) },
    availabilityException: { findMany: jest.fn(async () => params.exceptions ?? []) },
  } as unknown as PrismaService;
}

// A Wednesday well in the future, at local midnight UTC, so the "9-10am"
// weekday-3 rule always produces a slot within the next 14 days regardless
// of when the test runs.
function nextWednesday(from: Date): Date {
  const date = new Date(from);
  date.setUTCHours(0, 0, 0, 0);
  do {
    date.setUTCDate(date.getUTCDate() + 1);
  } while (date.getUTCDay() !== 3);
  return date;
}

describe('NextSlotService', () => {
  it('First-slot selection', async () => {
    const now = new Date('2026-01-05T00:00:00.000Z'); // a Monday
    const wednesday = nextWednesday(now);
    const prisma = fakePrisma({
      rules: [
        { doctorId: 'doc-1', weekday: 3, startMinute: 9 * 60, endMinute: 10 * 60 },
      ],
    });
    const service = new NextSlotService(prisma);

    const result = await service.nextSlotFor(
      [{ userId: 'doc-1', timezone: 'UTC', consultationMinutes: 30 }],
      now,
    );

    const next = result.get('doc-1');
    expect(next).not.toBeNull();
    expect(next?.toISOString().slice(0, 10)).toBe(wednesday.toISOString().slice(0, 10));
    expect(next?.getUTCHours()).toBe(9);
  });

  it('Doctors with no availability', async () => {
    const now = new Date('2026-01-05T00:00:00.000Z');
    const prisma = fakePrisma({ rules: [] });
    const service = new NextSlotService(prisma);

    const result = await service.nextSlotFor(
      [{ userId: 'doc-1', timezone: 'UTC', consultationMinutes: 30 }],
      now,
    );

    expect(result.get('doc-1')).toBeNull();
  });

  it('batches rule/exception loading in two queries regardless of doctor count', async () => {
    const now = new Date('2026-01-05T00:00:00.000Z');
    const prisma = fakePrisma({
      rules: [
        { doctorId: 'doc-1', weekday: 3, startMinute: 9 * 60, endMinute: 10 * 60 },
        { doctorId: 'doc-2', weekday: 3, startMinute: 9 * 60, endMinute: 10 * 60 },
      ],
    });
    const service = new NextSlotService(prisma);

    await service.nextSlotFor(
      [
        { userId: 'doc-1', timezone: 'UTC', consultationMinutes: 30 },
        { userId: 'doc-2', timezone: 'UTC', consultationMinutes: 30 },
      ],
      now,
    );

    expect(prisma.availabilityRule.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.availabilityException.findMany).toHaveBeenCalledTimes(1);
  });
});
