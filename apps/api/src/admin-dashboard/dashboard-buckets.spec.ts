import { describe, expect, it } from '@jest/globals';
import { computeDailyBuckets } from './dashboard-buckets.js';

describe('computeDailyBuckets', () => {
  it('Returns 29 buckets spanning 14 days back and 14 days forward, today marked', () => {
    const now = new Date('2026-06-15T12:00:00.000Z');
    const buckets = computeDailyBuckets([], 'UTC', now);

    expect(buckets).toHaveLength(29);
    expect(buckets[0]?.date).toBe('2026-06-01');
    expect(buckets[14]?.date).toBe('2026-06-15');
    expect(buckets[14]?.isToday).toBe(true);
    expect(buckets[28]?.date).toBe('2026-06-29');
    expect(buckets.every((b) => b.count === 0)).toBe(true);
  });

  it('Daily buckets in the admin time zone', () => {
    // 23:30 UTC on June 15 is 07:30 on June 16 in Asia/Manila (UTC+8).
    const now = new Date('2026-06-15T00:00:00.000Z');
    const appointment = new Date('2026-06-15T23:30:00.000Z');

    const utcBuckets = computeDailyBuckets([appointment], 'UTC', now);
    const manilaBuckets = computeDailyBuckets([appointment], 'Asia/Manila', now);

    expect(utcBuckets.find((b) => b.date === '2026-06-15')?.count).toBe(1);
    expect(utcBuckets.find((b) => b.date === '2026-06-16')?.count).toBe(0);

    expect(manilaBuckets.find((b) => b.date === '2026-06-16')?.count).toBe(1);
    expect(manilaBuckets.find((b) => b.date === '2026-06-15')?.count).toBe(0);
  });

  it('A timestamp outside the 29-day window is ignored', () => {
    const now = new Date('2026-06-15T12:00:00.000Z');
    const farFuture = new Date('2026-08-01T00:00:00.000Z');

    const buckets = computeDailyBuckets([farFuture], 'UTC', now);

    expect(buckets.reduce((sum, b) => sum + b.count, 0)).toBe(0);
  });
});
