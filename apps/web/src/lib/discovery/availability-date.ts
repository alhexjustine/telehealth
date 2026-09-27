import { TZDate } from '@date-fns/tz';
import { addDays, format, isValid, parse, startOfDay } from 'date-fns';

/** Search only looks this far ahead (the `doctor-discovery` spec's 14-day availability range). */
export const AVAILABILITY_WINDOW_DAYS = 14;

const DATE_PARAM_FORMAT = 'yyyy-MM-dd';

/** An inclusive range of local days; a single day has `from` equal to `to`. */
export interface DayRange {
  from: Date;
  to: Date;
}

/** The first and last pickable local days: today and 13 days after it. */
export function availabilityWindow(now: Date): { first: Date; last: Date } {
  const first = startOfDay(now);
  return { first, last: addDays(first, AVAILABILITY_WINDOW_DAYS - 1) };
}

export function formatAvailabilityDate(date: Date): string {
  return format(date, DATE_PARAM_FORMAT);
}

function parseDay(value: string, now: Date): Date | undefined {
  const date = parse(value, DATE_PARAM_FORMAT, now);
  return isValid(date) && formatAvailabilityDate(date) === value ? date : undefined;
}

/**
 * Parses the `from`/`to` URL values (`yyyy-MM-dd`; `to` defaults to `from`). Returns `undefined`
 * when `from` is missing or malformed, `to` is before `from`, or either falls outside the window.
 */
export function parseAvailabilityRange(
  fromValue: string | null,
  toValue: string | null,
  now: Date,
): DayRange | undefined {
  if (!fromValue) return undefined;
  const from = parseDay(fromValue, now);
  const to = toValue ? parseDay(toValue, now) : from;
  if (!from || !to || to < from) return undefined;
  const { first, last } = availabilityWindow(now);
  return from < first || to > last ? undefined : { from, to };
}

/**
 * Converts an inclusive range of local days (`yyyy-MM-dd`) to the `[from, to)` instant range the
 * search API takes: from the start of the first day in `timezone` (or `now`, when that day is
 * today, so past slots don't count) to the start of the day after the last one.
 */
export function availabilityRangeToQuery(
  fromValue: string,
  toValue: string,
  timezone: string,
  now: Date,
): { from: string; to: string } {
  const [fromYear, fromMonth, fromDay] = fromValue.split('-').map(Number) as [number, number, number];
  const [toYear, toMonth, toDay] = toValue.split('-').map(Number) as [number, number, number];
  const rangeStart = new TZDate(fromYear, fromMonth - 1, fromDay, 0, 0, 0, timezone);
  const rangeEnd = new TZDate(toYear, toMonth - 1, toDay + 1, 0, 0, 0, timezone);
  const from = Math.max(rangeStart.getTime(), now.getTime());
  return { from: new Date(from).toISOString(), to: new Date(rangeEnd.getTime()).toISOString() };
}
