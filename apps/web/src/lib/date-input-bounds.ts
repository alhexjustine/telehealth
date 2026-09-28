export const MAX_BIRTH_DATE_AGE_YEARS = 120;

/**
 * `min`/`max` bounds (`YYYY-MM-DD`) for a birthdate `<input type="date">`,
 * matching the "in the past, implying an age of at most 120 years" rule
 * already enforced server-side and by this app's own validation schemas
 * (the account's own profile, and dependents). Without these, the browser's
 * native date picker has no sensible range to work from: it centers on
 * today and offers future years too, which makes picking an old birthdate
 * (a parent, say) a long manual scroll and lets the picker suggest dates
 * the form will reject anyway.
 */
export function birthDateInputBounds(now: Date = new Date()): { min: string; max: string } {
  const min = new Date(now);
  min.setUTCFullYear(min.getUTCFullYear() - MAX_BIRTH_DATE_AGE_YEARS);
  return { min: toDateInputValue(min), max: toDateInputValue(now) };
}

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}
