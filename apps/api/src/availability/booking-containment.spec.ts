import { describe, expect, it } from '@jest/globals';
import { isBookingContained, intervalsOverlap } from './booking-containment.js';
import type { AvailabilityRuleInput } from './slot-generator.js';

describe('isBookingContained', () => {
  it('Contained appointment across a daylight-saving fall-back date', () => {
    // America/New_York, 2026-11-01: clocks repeat 01:00 -> 02:00. A booking at
    // the first occurrence of 01:00 local (EDT, UTC-4) is 2026-11-01T05:00:00Z.
    const appointment = {
      startsAt: new Date('2026-11-01T05:00:00Z'),
      endsAt: new Date('2026-11-01T05:30:00Z'),
    };
    const rules: AvailabilityRuleInput[] = [{ weekday: 7, startMinute: 0, endMinute: 3 * 60 }];

    expect(isBookingContained(appointment, rules, 'America/New_York')).toBe(true);
  });

  it('Appointment orphaned once the range no longer covers it, on the same DST date', () => {
    const appointment = {
      startsAt: new Date('2026-11-01T05:00:00Z'), // 01:00 EDT (first occurrence)
      endsAt: new Date('2026-11-01T05:30:00Z'), // 01:30 EDT
    };
    // The new range ends at local 01:00 (first occurrence), which is exactly
    // when the appointment starts: it no longer fits.
    const rules: AvailabilityRuleInput[] = [{ weekday: 7, startMinute: 0, endMinute: 60 }];

    expect(isBookingContained(appointment, rules, 'America/New_York')).toBe(false);
  });

  it('Contained appointment across a daylight-saving spring-forward date', () => {
    // America/New_York, 2026-03-08: clocks jump 02:00 -> 03:00. A 60-minute
    // booking starting at local 01:00 (EST, UTC-5) is 2026-03-08T06:00:00Z.
    const appointment = {
      startsAt: new Date('2026-03-08T06:00:00Z'),
      endsAt: new Date('2026-03-08T07:00:00Z'),
    };
    const rules: AvailabilityRuleInput[] = [{ weekday: 7, startMinute: 1 * 60, endMinute: 4 * 60 }];

    expect(isBookingContained(appointment, rules, 'America/New_York')).toBe(true);
  });

  it('No rule at all on the appointment\'s weekday', () => {
    const appointment = {
      startsAt: new Date('2026-09-28T09:00:00Z'), // a Monday, UTC
      endsAt: new Date('2026-09-28T09:30:00Z'),
    };
    const rules: AvailabilityRuleInput[] = [{ weekday: 2, startMinute: 0, endMinute: 24 * 60 }];

    expect(isBookingContained(appointment, rules, 'UTC')).toBe(false);
  });

  it('Contained within one of several ranges on the day', () => {
    const appointment = {
      startsAt: new Date('2026-09-28T14:00:00Z'),
      endsAt: new Date('2026-09-28T14:30:00Z'),
    };
    const rules: AvailabilityRuleInput[] = [
      { weekday: 1, startMinute: 9 * 60, endMinute: 10 * 60 },
      { weekday: 1, startMinute: 14 * 60, endMinute: 15 * 60 },
    ];

    expect(isBookingContained(appointment, rules, 'UTC')).toBe(true);
  });
});

describe('intervalsOverlap', () => {
  it('overlapping intervals', () => {
    expect(
      intervalsOverlap(
        new Date('2026-09-28T09:00:00Z'),
        new Date('2026-09-28T09:30:00Z'),
        new Date('2026-09-28T09:15:00Z'),
        new Date('2026-09-28T09:45:00Z'),
      ),
    ).toBe(true);
  });

  it('touching at the edge does not overlap (half-open)', () => {
    expect(
      intervalsOverlap(
        new Date('2026-09-28T09:00:00Z'),
        new Date('2026-09-28T09:30:00Z'),
        new Date('2026-09-28T09:30:00Z'),
        new Date('2026-09-28T10:00:00Z'),
      ),
    ).toBe(false);
  });
});
