import { TZDate } from '@date-fns/tz';

const LOCAL_DATETIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;

/**
 * Converts a `<input type="datetime-local">` value (no time-zone info) to a
 * UTC ISO instant, interpreting it in `timezone` — the doctor's own time
 * zone, not the browser's, per design.md's "Time off as UTC instants".
 */
export function localDateTimeToUtcIso(localValue: string, timezone: string): string {
  const match = LOCAL_DATETIME_PATTERN.exec(localValue);
  if (!match) {
    throw new Error(`Invalid datetime-local value: ${localValue}`);
  }
  const [, year, month, day, hour, minute] = match as unknown as [
    string,
    string,
    string,
    string,
    string,
    string,
  ];
  const tzDate = new TZDate(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    0,
    timezone,
  );
  // `TZDate#toISOString` formats with its own zone offset (e.g. `+08:00`), not
  // `Z`; going through a plain `Date` at the same instant gives the UTC form
  // the API expects.
  return new Date(tzDate.getTime()).toISOString();
}

/** The inverse of `localDateTimeToUtcIso`: formats a UTC instant for display/editing in `timezone`. */
export function utcIsoToLocalDateTime(isoValue: string, timezone: string): string {
  const tzDate = new TZDate(new Date(isoValue).getTime(), timezone);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${tzDate.getFullYear()}-${pad(tzDate.getMonth() + 1)}-${pad(tzDate.getDate())}T${pad(
    tzDate.getHours(),
  )}:${pad(tzDate.getMinutes())}`;
}
