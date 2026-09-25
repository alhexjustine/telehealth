/** Short "next available" label in the viewer's own (browser) time zone, e.g. "Mon, Oct 5, 9:00 AM". */
export function formatSlotDateTime(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}
