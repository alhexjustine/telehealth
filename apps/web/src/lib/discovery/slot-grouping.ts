import { TZDate } from '@date-fns/tz';

export interface SlotLike {
  start: string;
  end: string;
}

export interface SlotDayGroup {
  dateKey: string;
  label: string;
  slots: SlotLike[];
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** Groups slots (already sorted by start time by the API) by local calendar date in `timezone`. */
export function groupSlotsByLocalDate(slots: SlotLike[], timezone: string): SlotDayGroup[] {
  const groups: SlotDayGroup[] = [];
  const byKey = new Map<string, SlotDayGroup>();

  for (const slot of slots) {
    const tzDate = new TZDate(new Date(slot.start).getTime(), timezone);
    const dateKey = `${tzDate.getFullYear()}-${pad(tzDate.getMonth() + 1)}-${pad(tzDate.getDate())}`;
    let group = byKey.get(dateKey);
    if (!group) {
      const label = new Intl.DateTimeFormat(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        timeZone: timezone,
      }).format(new Date(slot.start));
      group = { dateKey, label, slots: [] };
      byKey.set(dateKey, group);
      groups.push(group);
    }
    group.slots.push(slot);
  }
  return groups;
}

export function formatSlotTimeOnly(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', timeZone: timezone }).format(
    new Date(iso),
  );
}

export function formatSlotDateAndTime(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
  }).format(new Date(iso));
}
