export const PHONE_PATTERN = /^\+?\d{7,20}$/;
export const MAX_AGE_YEARS = 120;

/** A birthday must be in the past and imply an age of at most 120 years. */
export function isValidBirthDate(value: string, now: Date = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return false;
  }
  if (date.getTime() >= now.getTime()) {
    return false;
  }
  const minDate = new Date(now);
  minDate.setUTCFullYear(minDate.getUTCFullYear() - MAX_AGE_YEARS);
  return date.getTime() >= minDate.getTime();
}
