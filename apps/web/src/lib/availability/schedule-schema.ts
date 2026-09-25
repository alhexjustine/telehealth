import { z } from 'zod';

export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
  7: 'Sunday',
};

const MINUTE_STEP = 15;
const MINUTES_PER_DAY = 24 * 60;

/** Every 15-minute step of the day, 00:00 through 24:00, for the range selects. */
export const MINUTE_OF_DAY_OPTIONS: number[] = Array.from(
  { length: MINUTES_PER_DAY / MINUTE_STEP + 1 },
  (_, i) => i * MINUTE_STEP,
);

export function formatMinuteOfDay(minute: number): string {
  const hours = Math.floor(minute / 60) % 24;
  const minutes = minute % 60;
  // 1440 formats as 24:00 (native Date wraps midnight to 00:00, which reads
  // like the day just started rather than just ended).
  const displayHours = minute === MINUTES_PER_DAY ? 24 : hours;
  return `${String(displayHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

let timeZoneCache: string[] | null = null;

/** All IANA time zones the browser knows, plus `UTC` (omitted by some browsers). */
export function getSupportedTimeZones(): string[] {
  if (!timeZoneCache) {
    const zones = new Set(Intl.supportedValuesOf('timeZone'));
    zones.add('UTC');
    timeZoneCache = [...zones].sort();
  }
  return timeZoneCache;
}

const ruleSchema = z.object({
  weekday: z.number().int().min(1).max(7),
  startMinute: z.number().int().min(0).max(MINUTES_PER_DAY),
  endMinute: z.number().int().min(0).max(MINUTES_PER_DAY),
});

/**
 * Mirrors the API's domain validator (`schedule-validator.ts`) so the editor
 * can show inline errors before submitting: order, minimum length against the
 * doctor's consultation length, and no overlap within the same weekday.
 * 15-minute alignment isn't re-checked here — the selects only offer aligned
 * values.
 */
export function buildScheduleSchema(consultationMinutes: number) {
  return z
    .object({
      timezone: z.string().refine((value) => getSupportedTimeZones().includes(value), {
        message: 'Unknown time zone',
      }),
      rules: z.array(ruleSchema),
    })
    .superRefine((value, ctx) => {
      const byWeekday = new Map<number, number[]>();
      value.rules.forEach((rule, index) => {
        const list = byWeekday.get(rule.weekday);
        if (list) list.push(index);
        else byWeekday.set(rule.weekday, [index]);

        if (rule.endMinute <= rule.startMinute) {
          ctx.addIssue({
            code: 'custom',
            message: 'End must be later than start',
            path: ['rules', index, 'endMinute'],
          });
        } else if (rule.endMinute - rule.startMinute < consultationMinutes) {
          ctx.addIssue({
            code: 'custom',
            message: `Shorter than one consultation (${consultationMinutes} min)`,
            path: ['rules', index, 'endMinute'],
          });
        }
      });

      for (const indices of byWeekday.values()) {
        const sorted = [...indices].sort(
          (a, b) => value.rules[a]!.startMinute - value.rules[b]!.startMinute,
        );
        for (let i = 1; i < sorted.length; i++) {
          const prevIndex = sorted[i - 1]!;
          const currIndex = sorted[i]!;
          if (value.rules[currIndex]!.startMinute < value.rules[prevIndex]!.endMinute) {
            ctx.addIssue({
              code: 'custom',
              message: 'Overlaps another range on this day',
              path: ['rules', prevIndex, 'startMinute'],
            });
            ctx.addIssue({
              code: 'custom',
              message: 'Overlaps another range on this day',
              path: ['rules', currIndex, 'startMinute'],
            });
          }
        }
      }
    });
}

export type ScheduleFormValues = z.infer<ReturnType<typeof buildScheduleSchema>>;
