import { describe, expect, it } from 'vitest';
import { localDateTimeToUtcIso, utcIsoToLocalDateTime } from './time-off-conversion';

describe('localDateTimeToUtcIso', () => {
  it('converts a local datetime-local value to a UTC instant', () => {
    expect(localDateTimeToUtcIso('2026-10-05T09:00', 'Asia/Manila')).toBe(
      '2026-10-05T01:00:00.000Z',
    );
  });

  it('interprets the value in the given time zone, not the host time zone', () => {
    expect(localDateTimeToUtcIso('2026-10-05T09:00', 'America/New_York')).toBe(
      '2026-10-05T13:00:00.000Z',
    );
  });

  it('round-trips through utcIsoToLocalDateTime', () => {
    const iso = localDateTimeToUtcIso('2026-01-15T14:30', 'Europe/Prague');
    expect(utcIsoToLocalDateTime(iso, 'Europe/Prague')).toBe('2026-01-15T14:30');
  });

  it('accounts for daylight saving in the target time zone', () => {
    // 2026-03-08: America/New_York clocks jump 02:00 -> 03:00.
    expect(localDateTimeToUtcIso('2026-03-08T01:00', 'America/New_York')).toBe(
      '2026-03-08T06:00:00.000Z',
    );
    expect(localDateTimeToUtcIso('2026-03-08T03:00', 'America/New_York')).toBe(
      '2026-03-08T07:00:00.000Z',
    );
  });
});

describe('utcIsoToLocalDateTime', () => {
  it('formats a UTC instant in the given time zone', () => {
    expect(utcIsoToLocalDateTime('2026-10-05T01:00:00.000Z', 'Asia/Manila')).toBe(
      '2026-10-05T09:00',
    );
  });
});
