import { describe, expect, it } from 'vitest';
import {
  JOIN_CLOSES_AFTER_MINUTES,
  JOIN_OPENS_BEFORE_MINUTES,
  isJoinable,
  joinWindowOpensAt,
} from './consultation-window';

const startsAt = '2026-01-01T10:00:00.000Z';
const endsAt = '2026-01-01T10:30:00.000Z';

function minutesFromStart(minutes: number): Date {
  return new Date(new Date(startsAt).getTime() + minutes * 60_000);
}

describe('isJoinable', () => {
  it('mirrors the API window constants (15 minutes before, 30 after)', () => {
    expect(JOIN_OPENS_BEFORE_MINUTES).toBe(15);
    expect(JOIN_CLOSES_AFTER_MINUTES).toBe(30);
  });

  it('Join action appears in the window', () => {
    expect(isJoinable({ status: 'BOOKED', startsAt, endsAt, now: minutesFromStart(-10) })).toBe(true);
  });

  it('is false before the window opens', () => {
    expect(isJoinable({ status: 'BOOKED', startsAt, endsAt, now: minutesFromStart(-20) })).toBe(false);
  });

  it('is false after the window closes', () => {
    expect(isJoinable({ status: 'BOOKED', startsAt, endsAt, now: minutesFromStart(61) })).toBe(false);
  });

  it('is true at the exact window edges', () => {
    expect(isJoinable({ status: 'BOOKED', startsAt, endsAt, now: minutesFromStart(-15) })).toBe(true);
    expect(isJoinable({ status: 'BOOKED', startsAt, endsAt, now: minutesFromStart(60) })).toBe(true);
  });

  it('is false when the appointment is not BOOKED', () => {
    expect(isJoinable({ status: 'CANCELLED', startsAt, endsAt, now: minutesFromStart(-10) })).toBe(false);
    expect(isJoinable({ status: 'COMPLETED', startsAt, endsAt, now: minutesFromStart(-10) })).toBe(false);
  });
});

describe('joinWindowOpensAt', () => {
  it('is 15 minutes before the start', () => {
    expect(joinWindowOpensAt(startsAt).toISOString()).toBe(minutesFromStart(-15).toISOString());
  });
});
