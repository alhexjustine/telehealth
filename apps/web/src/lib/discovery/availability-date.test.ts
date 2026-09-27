import { describe, expect, it } from 'vitest';
import { availabilityRangeToQuery, parseAvailabilityRange } from './availability-date';

describe('availabilityRangeToQuery', () => {
  it('covers every local day in the range, in the given time zone', () => {
    const now = new Date('2026-10-01T02:00:00.000Z');

    expect(availabilityRangeToQuery('2026-10-05', '2026-10-07', 'Asia/Manila', now)).toEqual({
      from: '2026-10-04T16:00:00.000Z',
      to: '2026-10-07T16:00:00.000Z',
    });
  });

  it('covers one whole day when the range is a single day', () => {
    const now = new Date('2026-10-01T02:00:00.000Z');

    expect(availabilityRangeToQuery('2026-10-05', '2026-10-05', 'Asia/Manila', now)).toEqual({
      from: '2026-10-04T16:00:00.000Z',
      to: '2026-10-05T16:00:00.000Z',
    });
  });

  it('starts from now when the range starts today', () => {
    const now = new Date('2026-10-01T02:00:00.000Z'); // 10:00 in Manila

    expect(availabilityRangeToQuery('2026-10-01', '2026-10-02', 'Asia/Manila', now)).toEqual({
      from: '2026-10-01T02:00:00.000Z',
      to: '2026-10-02T16:00:00.000Z',
    });
  });
});

describe('parseAvailabilityRange', () => {
  const now = new Date(2026, 9, 1, 10, 0, 0);

  it('accepts a range inside the 14-day window, and a lone start as a single day', () => {
    expect(parseAvailabilityRange('2026-10-03', '2026-10-14', now)).toEqual({
      from: new Date(2026, 9, 3),
      to: new Date(2026, 9, 14),
    });
    expect(parseAvailabilityRange('2026-10-03', null, now)).toEqual({
      from: new Date(2026, 9, 3),
      to: new Date(2026, 9, 3),
    });
  });

  it('rejects reversed ranges, days outside the window, and malformed values', () => {
    expect(parseAvailabilityRange('2026-10-05', '2026-10-04', now)).toBeUndefined();
    expect(parseAvailabilityRange('2026-09-30', '2026-10-02', now)).toBeUndefined();
    expect(parseAvailabilityRange('2026-10-10', '2026-10-15', now)).toBeUndefined();
    expect(parseAvailabilityRange('2026-13-01', null, now)).toBeUndefined();
    expect(parseAvailabilityRange(null, '2026-10-02', now)).toBeUndefined();
  });
});
