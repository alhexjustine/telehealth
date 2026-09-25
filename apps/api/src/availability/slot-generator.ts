import { TZDate } from '@date-fns/tz';

/** Slots starting sooner than this many minutes from now are hidden. Exported so
 * `add-appointment-booking` can reuse the same cutoff when it extends this module. */
export const SLOT_LEAD_MINUTES = 60;

export interface AvailabilityRuleInput {
  /** ISO weekday: Monday = 1 ... Sunday = 7. */
  weekday: number;
  /** Minutes since local midnight, 0-1440, a multiple of 15. */
  startMinute: number;
  endMinute: number;
}

export interface AvailabilityExceptionInput {
  startsAt: Date;
  endsAt: Date;
}

/** A doctor's existing `BOOKED` appointment interval; slots overlapping any of these are removed. */
export interface BookedIntervalInput {
  startsAt: Date;
  endsAt: Date;
}

export interface Slot {
  start: Date;
  end: Date;
}

export interface GenerateSlotsParams {
  /** IANA time zone the rules' minute-of-day values are interpreted in. */
  timezone: string;
  consultationMinutes: number;
  rules: AvailabilityRuleInput[];
  exceptions: AvailabilityExceptionInput[];
  /** The doctor's existing `BOOKED` appointments; defaults to none. */
  booked?: BookedIntervalInput[];
  /** Requested range, as UTC instants. Slots are returned only within `[from, to)`. */
  from: Date;
  to: Date;
  /** Injected clock so lead-time filtering is deterministic in tests. */
  now: Date;
  leadMinutes?: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Computes a doctor's bookable slots for `[from, to)`. Pure and side-effect
 * free: no clock, no I/O — see design.md's "Slot generator" decision for the
 * algorithm and its daylight-saving-time rules.
 */
export function generateSlots(params: GenerateSlotsParams): Slot[] {
  const {
    timezone,
    consultationMinutes,
    rules,
    exceptions,
    booked = [],
    from,
    to,
    now,
    leadMinutes = SLOT_LEAD_MINUTES,
  } = params;

  if (rules.length === 0 || consultationMinutes <= 0) return [];

  const consultationMs = consultationMinutes * 60_000;
  const leadCutoffMs = now.getTime() + leadMinutes * 60_000;
  const fromMs = from.getTime();
  const toMs = to.getTime();

  const rulesByWeekday = new Map<number, AvailabilityRuleInput[]>();
  for (const rule of rules) {
    const list = rulesByWeekday.get(rule.weekday);
    if (list) list.push(rule);
    else rulesByWeekday.set(rule.weekday, [rule]);
  }
  if (rulesByWeekday.size === 0) return [];

  // Enumerate local calendar dates covering `[from, to]`, padded by one day on
  // each side: a range's start/end instant can fall on a different local
  // calendar date than a naive UTC read would suggest once a time-zone offset
  // is applied.
  const start = localCalendarDate(from, timezone);
  const end = localCalendarDate(to, timezone);
  let cursor = Date.UTC(start.year, start.month, start.day - 1);
  const last = Date.UTC(end.year, end.month, end.day + 1);

  const slots: Slot[] = [];
  while (cursor <= last) {
    const calendarDay = new Date(cursor);
    const year = calendarDay.getUTCFullYear();
    const month = calendarDay.getUTCMonth();
    const day = calendarDay.getUTCDate();
    const weekday = isoWeekday(calendarDay);

    const dayRules = rulesByWeekday.get(weekday);
    if (dayRules) {
      for (const rule of dayRules) {
        collectSlotsForRange(rule, year, month, day, timezone, consultationMs, exceptions, booked, {
          fromMs,
          toMs,
          leadCutoffMs,
        }).forEach((slot) => slots.push(slot));
      }
    }
    cursor += DAY_MS;
  }

  slots.sort((a, b) => a.start.getTime() - b.start.getTime());
  return dedupeSorted(slots);
}

function collectSlotsForRange(
  rule: AvailabilityRuleInput,
  year: number,
  month: number,
  day: number,
  timezone: string,
  consultationMs: number,
  exceptions: AvailabilityExceptionInput[],
  booked: BookedIntervalInput[],
  bounds: { fromMs: number; toMs: number; leadCutoffMs: number },
): Slot[] {
  const rangeStart = localMinuteToInstant(year, month, day, rule.startMinute, timezone).getTime();
  const rangeEnd = localMinuteToInstant(year, month, day, rule.endMinute, timezone).getTime();

  const slots: Slot[] = [];
  // Real-elapsed-time stepping from the range's start instant, not local
  // wall-clock arithmetic: this is what keeps slot duration correct across a
  // daylight-saving change within the range (design.md's spring/fall-back
  // scenarios).
  let slotStartMs = rangeStart;
  while (slotStartMs + consultationMs <= rangeEnd) {
    const slotEndMs = slotStartMs + consultationMs;
    if (
      slotStartMs >= bounds.fromMs &&
      slotStartMs < bounds.toMs &&
      slotStartMs >= bounds.leadCutoffMs &&
      !overlapsInterval(slotStartMs, slotEndMs, exceptions) &&
      !overlapsInterval(slotStartMs, slotEndMs, booked)
    ) {
      slots.push({ start: new Date(slotStartMs), end: new Date(slotEndMs) });
    }
    slotStartMs = slotEndMs;
  }
  return slots;
}

function overlapsInterval(
  slotStartMs: number,
  slotEndMs: number,
  intervals: { startsAt: Date; endsAt: Date }[],
): boolean {
  // Half-open intervals: a slot that only touches an interval's edge (ends
  // exactly when it starts, or starts exactly when it ends) does not overlap.
  // Used for both time-off exceptions and booked appointments, whose
  // overlap semantics are identical.
  return intervals.some(
    (interval) => slotStartMs < interval.endsAt.getTime() && slotEndMs > interval.startsAt.getTime(),
  );
}

/** The local calendar date (in `timezone`) a UTC instant falls on. */
export function localCalendarDate(date: Date, timezone: string): { year: number; month: number; day: number } {
  const tzDate = new TZDate(+date, timezone);
  return { year: tzDate.getFullYear(), month: tzDate.getMonth(), day: tzDate.getDate() };
}

/**
 * Resolves a local calendar date + minute-of-day (in `timezone`) to the UTC
 * instant it names, with the same daylight-saving-time rules `generateSlots`
 * uses for range boundaries: a skipped local time moves forward to the first
 * valid time after it, and a repeated local time uses its first occurrence
 * (both `TZDate`'s own behavior). Exported so `add-appointment-booking`'s
 * schedule/time-off booking-containment checks resolve local ranges to
 * instants the same way slot generation does, instead of duplicating the
 * logic and risking drift.
 */
export function localMinuteToInstant(
  year: number,
  month: number,
  day: number,
  minuteOfDay: number,
  timezone: string,
): Date {
  const hours = Math.floor(minuteOfDay / 60);
  const minutes = minuteOfDay % 60;
  return new TZDate(year, month, day, hours, minutes, 0, timezone);
}

/** ISO weekday (Monday = 1 ... Sunday = 7) of a UTC-anchored calendar date. */
export function isoWeekday(utcDate: Date): number {
  const day = utcDate.getUTCDay();
  return day === 0 ? 7 : day;
}

function dedupeSorted(slots: Slot[]): Slot[] {
  const result: Slot[] = [];
  for (const slot of slots) {
    const previous = result[result.length - 1];
    if (previous && previous.start.getTime() === slot.start.getTime() && previous.end.getTime() === slot.end.getTime()) {
      continue;
    }
    result.push(slot);
  }
  return result;
}
