import { TZDate } from '@date-fns/tz';

/**
 * A UTC instant `days` days before `now`, at `hour:minute` in `timezone`.
 * Only used for already-`COMPLETED`/`CANCELLED` rows, which — unlike
 * `BOOKED` ones — aren't required to land on a slot `generateSlots` would
 * offer, so this doesn't need `generateSlots`' own machinery.
 */
export function pastLocalInstant(now: Date, days: number, hour: number, minute: number, timezone: string): Date {
  const base = new Date(now.getTime() - days * 86_400_000);
  const local = new TZDate(+base, timezone);
  const instant = new TZDate(local.getFullYear(), local.getMonth(), local.getDate(), hour, minute, 0, timezone);
  // `TZDate#toISOString()`/arithmetic keep the zone's own offset; a plain
  // `Date` built from its epoch millis is what the rest of the app (and
  // Prisma) expects — see CLAUDE.md's `@date-fns/tz` gotcha.
  return new Date(instant.getTime());
}
