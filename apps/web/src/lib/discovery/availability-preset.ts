import { TZDate } from '@date-fns/tz';

export const AVAILABILITY_PRESETS = ['any', 'today', '3days', '7days', '14days'] as const;
export type AvailabilityPreset = (typeof AVAILABILITY_PRESETS)[number];

export const AVAILABILITY_PRESET_LABELS: Record<AvailabilityPreset, string> = {
  any: 'Any time',
  today: 'Today',
  '3days': 'Next 3 days',
  '7days': 'Next 7 days',
  '14days': 'Next 14 days',
};

const PRESET_DAYS: Record<Exclude<AvailabilityPreset, 'any'>, number> = {
  today: 1,
  '3days': 3,
  '7days': 7,
  '14days': 14,
};

/**
 * Converts an availability preset to a concrete `[from, to)` instant range,
 * anchored at `now` and ending at local midnight `N` days out in `timezone`
 * (the browser's own zone) — see design.md's "the availability filter's
 * presets are converted to instants in the browser's time zone". `'any'`
 * means no filter.
 */
export function availabilityPresetToRange(
  preset: AvailabilityPreset,
  timezone: string,
  now: Date,
): { from: string; to: string } | undefined {
  if (preset === 'any') return undefined;
  const days = PRESET_DAYS[preset];
  const local = new TZDate(+now, timezone);
  const endOfRange = new TZDate(
    local.getFullYear(),
    local.getMonth(),
    local.getDate() + days,
    0,
    0,
    0,
    timezone,
  );
  return { from: now.toISOString(), to: new Date(endOfRange.getTime()).toISOString() };
}
