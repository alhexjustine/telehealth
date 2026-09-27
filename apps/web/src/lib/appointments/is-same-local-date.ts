/** Whether `iso` falls on `reference`'s calendar date in `timezone`. */
export function isSameLocalDate(iso: string, timezone: string, reference: Date): boolean {
  const format = (date: Date) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
      date,
    );
  return format(new Date(iso)) === format(reference);
}
