export interface ScheduleRuleInput {
  weekday: number;
  startMinute: number;
  endMinute: number;
}

export interface ScheduleValidationError {
  /** `timezone`, or `rules[<index>]` for the index in the submitted array. */
  field: string;
  message: string;
}

const MINUTE_STEP = 15;

let timeZoneCache: Set<string> | null = null;

/**
 * `Intl.supportedValuesOf('timeZone')` omits `UTC` in some runtimes even
 * though `Intl.DateTimeFormat` accepts it, so it's added back explicitly.
 */
function supportedTimeZones(): Set<string> {
  if (!timeZoneCache) {
    timeZoneCache = new Set([...Intl.supportedValuesOf('timeZone'), 'UTC']);
  }
  return timeZoneCache;
}

/**
 * Cross-field validation the DTO's per-property decorators can't express:
 * order, minimum length against the doctor's consultation length, 15-minute
 * alignment, weekday overlap, and time zone validity. Returns field-indexed
 * errors so the UI can highlight the offending range; an empty array means
 * the schedule is valid.
 */
export function validateSchedule(
  input: { timezone: string; rules: ScheduleRuleInput[] },
  consultationMinutes: number,
): ScheduleValidationError[] {
  const errors: ScheduleValidationError[] = [];

  if (!supportedTimeZones().has(input.timezone)) {
    errors.push({ field: 'timezone', message: `Unknown time zone: ${input.timezone}` });
  }

  const validByIndex = new Map<number, ScheduleRuleInput>();
  input.rules.forEach((rule, index) => {
    const field = `rules[${index}]`;
    if (rule.startMinute % MINUTE_STEP !== 0 || rule.endMinute % MINUTE_STEP !== 0) {
      errors.push({ field, message: 'Start and end must be on a 15-minute step' });
      return;
    }
    if (rule.endMinute <= rule.startMinute) {
      errors.push({ field, message: 'End must be later than start' });
      return;
    }
    if (rule.endMinute - rule.startMinute < consultationMinutes) {
      errors.push({
        field,
        message: `Range is shorter than one consultation (${consultationMinutes} minutes)`,
      });
      return;
    }
    validByIndex.set(index, rule);
  });

  errors.push(...findOverlaps(validByIndex));

  return errors;
}

function findOverlaps(validByIndex: Map<number, ScheduleRuleInput>): ScheduleValidationError[] {
  const byWeekday = new Map<number, number[]>();
  for (const [index, rule] of validByIndex) {
    const list = byWeekday.get(rule.weekday);
    if (list) list.push(index);
    else byWeekday.set(rule.weekday, [index]);
  }

  const errors: ScheduleValidationError[] = [];
  const overlapping = new Set<number>();
  for (const indices of byWeekday.values()) {
    const sorted = [...indices].sort(
      (a, b) => validByIndex.get(a)!.startMinute - validByIndex.get(b)!.startMinute,
    );
    for (let i = 1; i < sorted.length; i++) {
      const prevIndex = sorted[i - 1]!;
      const currIndex = sorted[i]!;
      const prev = validByIndex.get(prevIndex)!;
      const curr = validByIndex.get(currIndex)!;
      if (curr.startMinute < prev.endMinute) {
        overlapping.add(prevIndex);
        overlapping.add(currIndex);
      }
    }
  }
  for (const index of [...overlapping].sort((a, b) => a - b)) {
    errors.push({ field: `rules[${index}]`, message: 'Overlaps another range on the same day' });
  }
  return errors;
}
