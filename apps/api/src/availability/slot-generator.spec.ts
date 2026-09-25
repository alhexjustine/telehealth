import { describe, expect, it } from '@jest/globals';
import { generateSlots, SLOT_LEAD_MINUTES, type AvailabilityRuleInput } from './slot-generator.js';

// 2026-09-28 is a Monday in UTC, so range math below doesn't depend on the
// current date.
const FAR_PAST_NOW = new Date('2026-01-01T00:00:00Z');

function utcRange(fromIso: string, toIso: string) {
  return { from: new Date(fromIso), to: new Date(toIso) };
}

describe('generateSlots', () => {
  it('Slots follow the schedule and consultation length', () => {
    const rules: AvailabilityRuleInput[] = [{ weekday: 1, startMinute: 9 * 60, endMinute: 12 * 60 }];
    const { from, to } = utcRange('2026-09-28T00:00:00Z', '2026-09-29T00:00:00Z');

    const slots = generateSlots({
      timezone: 'UTC',
      consultationMinutes: 30,
      rules,
      exceptions: [],
      from,
      to,
      now: FAR_PAST_NOW,
    });

    expect(slots.map((s) => s.start.toISOString())).toEqual([
      '2026-09-28T09:00:00.000Z',
      '2026-09-28T09:30:00.000Z',
      '2026-09-28T10:00:00.000Z',
      '2026-09-28T10:30:00.000Z',
      '2026-09-28T11:00:00.000Z',
      '2026-09-28T11:30:00.000Z',
    ]);
    expect(slots.every((s) => s.end.getTime() - s.start.getTime() === 30 * 60_000)).toBe(true);
  });

  it('Consultation length does not divide the range', () => {
    const rules: AvailabilityRuleInput[] = [{ weekday: 1, startMinute: 9 * 60, endMinute: 12 * 60 }];
    const { from, to } = utcRange('2026-09-28T00:00:00Z', '2026-09-29T00:00:00Z');

    const slots = generateSlots({
      timezone: 'UTC',
      consultationMinutes: 45,
      rules,
      exceptions: [],
      from,
      to,
      now: FAR_PAST_NOW,
    });

    expect(slots.map((s) => s.start.toISOString())).toEqual([
      '2026-09-28T09:00:00.000Z',
      '2026-09-28T09:45:00.000Z',
      '2026-09-28T10:30:00.000Z',
      '2026-09-28T11:15:00.000Z',
    ]);
  });

  it('Time off removes overlapping slots', () => {
    const rules: AvailabilityRuleInput[] = [{ weekday: 1, startMinute: 9 * 60, endMinute: 12 * 60 }];
    const { from, to } = utcRange('2026-09-28T00:00:00Z', '2026-09-29T00:00:00Z');

    const slots = generateSlots({
      timezone: 'UTC',
      consultationMinutes: 30,
      rules,
      exceptions: [
        { startsAt: new Date('2026-09-28T10:15:00Z'), endsAt: new Date('2026-09-28T11:00:00Z') },
      ],
      from,
      to,
      now: FAR_PAST_NOW,
    });

    expect(slots.map((s) => s.start.toISOString())).toEqual([
      '2026-09-28T09:00:00.000Z',
      '2026-09-28T09:30:00.000Z',
      '2026-09-28T11:00:00.000Z',
      '2026-09-28T11:30:00.000Z',
    ]);
  });

  it('Too-soon slots removed', () => {
    // now is exactly on a 30-minute slot boundary so the lead cutoff lines up
    // with slot start times.
    const now = new Date('2026-09-25T09:00:00Z'); // a Friday
    const rules: AvailabilityRuleInput[] = [{ weekday: 5, startMinute: 0, endMinute: 24 * 60 }];
    const { from, to } = utcRange('2026-09-25T00:00:00Z', '2026-09-26T00:00:00Z');

    const slots = generateSlots({
      timezone: 'UTC',
      consultationMinutes: 30,
      rules,
      exceptions: [],
      from,
      to,
      now,
    });

    expect(slots.some((s) => s.start.toISOString() === '2026-09-25T09:30:00.000Z')).toBe(false);
    expect(slots.some((s) => s.start.toISOString() === '2026-09-25T10:30:00.000Z')).toBe(true);
  });

  it('respects a custom lead time', () => {
    const now = new Date('2026-09-25T09:00:00Z');
    const rules: AvailabilityRuleInput[] = [{ weekday: 5, startMinute: 0, endMinute: 24 * 60 }];
    const { from, to } = utcRange('2026-09-25T00:00:00Z', '2026-09-26T00:00:00Z');

    const slots = generateSlots({
      timezone: 'UTC',
      consultationMinutes: 30,
      rules,
      exceptions: [],
      from,
      to,
      now,
      leadMinutes: 0,
    });

    expect(slots.some((s) => s.start.toISOString() === '2026-09-25T09:00:00.000Z')).toBe(true);
  });

  it('SLOT_LEAD_MINUTES defaults to 60', () => {
    expect(SLOT_LEAD_MINUTES).toBe(60);
  });

  it('Clocks spring forward', () => {
    // America/New_York, 2026-03-08: clocks jump 02:00 -> 03:00.
    const rules: AvailabilityRuleInput[] = [{ weekday: 7, startMinute: 1 * 60, endMinute: 4 * 60 }];
    const { from, to } = utcRange('2026-03-07T00:00:00Z', '2026-03-10T00:00:00Z');

    const slots = generateSlots({
      timezone: 'America/New_York',
      consultationMinutes: 60,
      rules,
      exceptions: [],
      from,
      to,
      now: FAR_PAST_NOW,
    });

    expect(slots).toHaveLength(2);
    expect(slots.map((s) => s.start.toISOString())).toEqual([
      '2026-03-08T06:00:00.000Z', // 01:00 EST
      '2026-03-08T07:00:00.000Z', // 03:00 EDT (02:00 does not exist)
    ]);
    expect(slots.every((s) => s.end.getTime() - s.start.getTime() === 60 * 60_000)).toBe(true);
  });

  it('Clocks fall back', () => {
    // America/New_York, 2026-11-01: clocks repeat 01:00 -> 02:00.
    const rules: AvailabilityRuleInput[] = [{ weekday: 7, startMinute: 1 * 60, endMinute: 3 * 60 }];
    const { from, to } = utcRange('2026-10-31T00:00:00Z', '2026-11-03T00:00:00Z');

    const slots = generateSlots({
      timezone: 'America/New_York',
      consultationMinutes: 60,
      rules,
      exceptions: [],
      from,
      to,
      now: FAR_PAST_NOW,
    });

    expect(slots).toHaveLength(3);
    expect(slots.map((s) => s.start.toISOString())).toEqual([
      '2026-11-01T05:00:00.000Z', // 01:00 EDT, first occurrence
      '2026-11-01T06:00:00.000Z', // 01:00 EST, second occurrence
      '2026-11-01T07:00:00.000Z', // 02:00 EST
    ]);
    expect(slots.every((s) => s.end.getTime() - s.start.getTime() === 60 * 60_000)).toBe(true);
  });

  it('lays out slots from multiple ranges on the same day', () => {
    const rules: AvailabilityRuleInput[] = [
      { weekday: 1, startMinute: 9 * 60, endMinute: 10 * 60 },
      { weekday: 1, startMinute: 14 * 60, endMinute: 15 * 60 },
    ];
    const { from, to } = utcRange('2026-09-28T00:00:00Z', '2026-09-29T00:00:00Z');

    const slots = generateSlots({
      timezone: 'UTC',
      consultationMinutes: 30,
      rules,
      exceptions: [],
      from,
      to,
      now: FAR_PAST_NOW,
    });

    expect(slots.map((s) => s.start.toISOString())).toEqual([
      '2026-09-28T09:00:00.000Z',
      '2026-09-28T09:30:00.000Z',
      '2026-09-28T14:00:00.000Z',
      '2026-09-28T14:30:00.000Z',
    ]);
  });

  it('does not remove a slot an exception only touches at the edge', () => {
    const rules: AvailabilityRuleInput[] = [{ weekday: 1, startMinute: 9 * 60, endMinute: 12 * 60 }];
    const { from, to } = utcRange('2026-09-28T00:00:00Z', '2026-09-29T00:00:00Z');

    const slots = generateSlots({
      timezone: 'UTC',
      consultationMinutes: 30,
      rules,
      // Ends exactly when the first slot starts, and starts exactly when the
      // last slot ends: neither should overlap (half-open intervals).
      exceptions: [
        { startsAt: new Date('2026-09-28T08:30:00Z'), endsAt: new Date('2026-09-28T09:00:00Z') },
        { startsAt: new Date('2026-09-28T12:00:00Z'), endsAt: new Date('2026-09-28T12:30:00Z') },
      ],
      from,
      to,
      now: FAR_PAST_NOW,
    });

    expect(slots.map((s) => s.start.toISOString())).toEqual([
      '2026-09-28T09:00:00.000Z',
      '2026-09-28T09:30:00.000Z',
      '2026-09-28T10:00:00.000Z',
      '2026-09-28T10:30:00.000Z',
      '2026-09-28T11:00:00.000Z',
      '2026-09-28T11:30:00.000Z',
    ]);
  });

  it('removes a slot an exception overlaps by even a minute', () => {
    const rules: AvailabilityRuleInput[] = [{ weekday: 1, startMinute: 9 * 60, endMinute: 9 * 60 + 30 }];
    const { from, to } = utcRange('2026-09-28T00:00:00Z', '2026-09-29T00:00:00Z');

    const slots = generateSlots({
      timezone: 'UTC',
      consultationMinutes: 30,
      rules,
      exceptions: [
        { startsAt: new Date('2026-09-28T09:00:00Z'), endsAt: new Date('2026-09-28T09:01:00Z') },
      ],
      from,
      to,
      now: FAR_PAST_NOW,
    });

    expect(slots).toHaveLength(0);
  });

  it('produces one slot per matching weekday across several weeks', () => {
    const rules: AvailabilityRuleInput[] = [{ weekday: 1, startMinute: 9 * 60, endMinute: 9 * 60 + 30 }];
    const { from, to } = utcRange('2026-09-28T00:00:00Z', '2026-10-20T00:00:00Z'); // 4 Mondays

    const slots = generateSlots({
      timezone: 'UTC',
      consultationMinutes: 30,
      rules,
      exceptions: [],
      from,
      to,
      now: FAR_PAST_NOW,
    });

    expect(slots.map((s) => s.start.toISOString())).toEqual([
      '2026-09-28T09:00:00.000Z',
      '2026-10-05T09:00:00.000Z',
      '2026-10-12T09:00:00.000Z',
      '2026-10-19T09:00:00.000Z',
    ]);
  });

  it('Booked slot removed', () => {
    const rules: AvailabilityRuleInput[] = [{ weekday: 1, startMinute: 9 * 60, endMinute: 12 * 60 }];
    const { from, to } = utcRange('2026-09-28T00:00:00Z', '2026-09-29T00:00:00Z');

    const withoutBooking = generateSlots({
      timezone: 'UTC',
      consultationMinutes: 30,
      rules,
      exceptions: [],
      from,
      to,
      now: FAR_PAST_NOW,
    });
    expect(withoutBooking.map((s) => s.start.toISOString())).toContain('2026-09-28T10:00:00.000Z');

    const withBooking = generateSlots({
      timezone: 'UTC',
      consultationMinutes: 30,
      rules,
      exceptions: [],
      booked: [{ startsAt: new Date('2026-09-28T10:00:00Z'), endsAt: new Date('2026-09-28T10:30:00Z') }],
      from,
      to,
      now: FAR_PAST_NOW,
    });

    expect(withBooking.map((s) => s.start.toISOString())).toEqual([
      '2026-09-28T09:00:00.000Z',
      '2026-09-28T09:30:00.000Z',
      '2026-09-28T10:30:00.000Z',
      '2026-09-28T11:00:00.000Z',
      '2026-09-28T11:30:00.000Z',
    ]);
  });

  it('Booking of a different length', () => {
    // Doctor changed consultation length from 30 to 45 minutes while holding
    // a 30-minute booking at 09:00 on a Monday 09:00-12:00 range: slots lay
    // out from the range start at the new 45-minute length, and every slot
    // overlapping 09:00-09:30 is removed.
    const rules: AvailabilityRuleInput[] = [{ weekday: 1, startMinute: 9 * 60, endMinute: 12 * 60 }];
    const { from, to } = utcRange('2026-09-28T00:00:00Z', '2026-09-29T00:00:00Z');

    const slots = generateSlots({
      timezone: 'UTC',
      consultationMinutes: 45,
      rules,
      exceptions: [],
      booked: [{ startsAt: new Date('2026-09-28T09:00:00Z'), endsAt: new Date('2026-09-28T09:30:00Z') }],
      from,
      to,
      now: FAR_PAST_NOW,
    });

    expect(slots.map((s) => s.start.toISOString())).toEqual([
      '2026-09-28T09:45:00.000Z',
      '2026-09-28T10:30:00.000Z',
      '2026-09-28T11:15:00.000Z',
    ]);
  });

  it('returns nothing when there are no rules', () => {
    const { from, to } = utcRange('2026-09-28T00:00:00Z', '2026-09-29T00:00:00Z');
    const slots = generateSlots({
      timezone: 'UTC',
      consultationMinutes: 30,
      rules: [],
      exceptions: [],
      from,
      to,
      now: FAR_PAST_NOW,
    });
    expect(slots).toEqual([]);
  });
});
