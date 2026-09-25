import { describe, expect, it } from '@jest/globals';
import { validateSchedule, type ScheduleRuleInput } from './schedule-validator.js';

describe('validateSchedule', () => {
  it('accepts a valid schedule', () => {
    const rules: ScheduleRuleInput[] = [
      { weekday: 1, startMinute: 9 * 60, endMinute: 12 * 60 },
      { weekday: 1, startMinute: 13 * 60, endMinute: 17 * 60 },
    ];
    const errors = validateSchedule({ timezone: 'Asia/Manila', rules }, 30);
    expect(errors).toEqual([]);
  });

  it('accepts an empty schedule', () => {
    const errors = validateSchedule({ timezone: 'UTC', rules: [] }, 30);
    expect(errors).toEqual([]);
  });

  it('rejects overlapping ranges on the same weekday, indexed by field', () => {
    const rules: ScheduleRuleInput[] = [
      { weekday: 1, startMinute: 9 * 60, endMinute: 12 * 60 },
      { weekday: 1, startMinute: 11 * 60, endMinute: 14 * 60 },
    ];
    const errors = validateSchedule({ timezone: 'UTC', rules }, 30);
    expect(errors.map((e) => e.field)).toEqual(['rules[0]', 'rules[1]']);
  });

  it('does not flag ranges that only touch at the edge', () => {
    const rules: ScheduleRuleInput[] = [
      { weekday: 1, startMinute: 9 * 60, endMinute: 12 * 60 },
      { weekday: 1, startMinute: 12 * 60, endMinute: 14 * 60 },
    ];
    const errors = validateSchedule({ timezone: 'UTC', rules }, 30);
    expect(errors).toEqual([]);
  });

  it('rejects a range whose end is not after its start, field-indexed', () => {
    const rules: ScheduleRuleInput[] = [{ weekday: 1, startMinute: 14 * 60, endMinute: 13 * 60 }];
    const errors = validateSchedule({ timezone: 'UTC', rules }, 30);
    expect(errors).toEqual([{ field: 'rules[0]', message: expect.any(String) }]);
  });

  it('rejects a range whose start or end is not on a 15-minute step', () => {
    const rules: ScheduleRuleInput[] = [{ weekday: 1, startMinute: 9 * 60 + 5, endMinute: 12 * 60 }];
    const errors = validateSchedule({ timezone: 'UTC', rules }, 30);
    expect(errors).toEqual([{ field: 'rules[0]', message: expect.any(String) }]);
  });

  it('rejects a range shorter than one consultation, field-indexed', () => {
    const rules: ScheduleRuleInput[] = [{ weekday: 1, startMinute: 9 * 60, endMinute: 9 * 60 + 30 }];
    const errors = validateSchedule({ timezone: 'UTC', rules }, 45);
    expect(errors).toEqual([{ field: 'rules[0]', message: expect.any(String) }]);
  });

  it('accepts a range exactly as long as one consultation', () => {
    const rules: ScheduleRuleInput[] = [{ weekday: 1, startMinute: 9 * 60, endMinute: 9 * 60 + 45 }];
    const errors = validateSchedule({ timezone: 'UTC', rules }, 45);
    expect(errors).toEqual([]);
  });

  it('rejects an unknown time zone, field-indexed', () => {
    const errors = validateSchedule({ timezone: 'Mars/Olympus', rules: [] }, 30);
    expect(errors).toEqual([{ field: 'timezone', message: expect.any(String) }]);
  });

  it('accepts UTC even if the runtime omits it from supportedValuesOf', () => {
    const errors = validateSchedule({ timezone: 'UTC', rules: [] }, 30);
    expect(errors).toEqual([]);
  });

  it('reports multiple independent errors together', () => {
    const rules: ScheduleRuleInput[] = [
      { weekday: 1, startMinute: 14 * 60, endMinute: 13 * 60 },
      { weekday: 2, startMinute: 9 * 60, endMinute: 9 * 60 + 30 },
    ];
    const errors = validateSchedule({ timezone: 'Mars/Olympus', rules }, 45);
    expect(errors.map((e) => e.field).sort()).toEqual(['rules[0]', 'rules[1]', 'timezone']);
  });
});
