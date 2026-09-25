import {
  isoWeekday,
  localCalendarDate,
  localMinuteToInstant,
  type AvailabilityRuleInput,
} from './slot-generator.js';

export interface BookedAppointmentInterval {
  startsAt: Date;
  endsAt: Date;
}

/**
 * Whether `appointment`'s interval lies entirely within one of `rules`' local
 * ranges, on the appointment's own local calendar date in `timezone` — using
 * the same local-to-instant resolution `generateSlots` uses for range
 * boundaries (`localMinuteToInstant`'s daylight-saving rules), so an
 * appointment `generateSlots` would still offer a slot for stays contained
 * after the schedule or time zone changes. Used to reject a schedule save
 * that would otherwise orphan an existing `BOOKED` appointment.
 */
export function isBookingContained(
  appointment: BookedAppointmentInterval,
  rules: AvailabilityRuleInput[],
  timezone: string,
): boolean {
  const { year, month, day } = localCalendarDate(appointment.startsAt, timezone);
  const weekday = isoWeekday(new Date(Date.UTC(year, month, day)));
  const startMs = appointment.startsAt.getTime();
  const endMs = appointment.endsAt.getTime();

  return rules
    .filter((rule) => rule.weekday === weekday)
    .some((rule) => {
      const rangeStart = localMinuteToInstant(year, month, day, rule.startMinute, timezone).getTime();
      const rangeEnd = localMinuteToInstant(year, month, day, rule.endMinute, timezone).getTime();
      return startMs >= rangeStart && endMs <= rangeEnd;
    });
}

/** Half-open-interval overlap, matching `generateSlots`' overlap semantics. */
export function intervalsOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart.getTime() < bEnd.getTime() && aEnd.getTime() > bStart.getTime();
}
