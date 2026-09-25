import { localCalendarDate } from '../availability/slot-generator.js';

export interface DashboardTrendBucket {
  /** `YYYY-MM-DD`, the local calendar date in the requested time zone. */
  date: string;
  count: number;
  isToday: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;
export const TREND_PAST_DAYS = 14;
export const TREND_FUTURE_DAYS = 14;

function dateKey(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Buckets appointment start times into 29 daily buckets — the past 14 days,
 * today, and the next 14 days — keyed by each timestamp's *local* calendar
 * date in `timezone` (the same resolution `generateSlots`' `localCalendarDate`
 * uses), not its UTC calendar date. A timestamp outside the 29-day window is
 * silently ignored (the caller is expected to have already queried only the
 * relevant range). See design.md's "Dashboard queries" and the
 * `admin-dashboard` spec's "Daily buckets in the admin's time zone".
 */
export function computeDailyBuckets(startTimes: Date[], timezone: string, now: Date): DashboardTrendBucket[] {
  const today = localCalendarDate(now, timezone);
  const todayUtcMs = Date.UTC(today.year, today.month, today.day);
  const todayKey = dateKey(today.year, today.month, today.day);

  const counts = new Map<string, number>();
  for (let offset = -TREND_PAST_DAYS; offset <= TREND_FUTURE_DAYS; offset++) {
    const d = new Date(todayUtcMs + offset * DAY_MS);
    counts.set(dateKey(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()), 0);
  }

  for (const startsAt of startTimes) {
    const local = localCalendarDate(startsAt, timezone);
    const key = dateKey(local.year, local.month, local.day);
    if (counts.has(key)) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  return [...counts.entries()].map(([date, count]) => ({ date, count, isToday: date === todayKey }));
}
