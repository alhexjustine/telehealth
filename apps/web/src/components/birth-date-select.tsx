import { useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { MAX_BIRTH_DATE_AGE_YEARS } from '@/lib/date-input-bounds';

const MONTHS = [
  { abbr: 'Jan', full: 'January' },
  { abbr: 'Feb', full: 'February' },
  { abbr: 'Mar', full: 'March' },
  { abbr: 'Apr', full: 'April' },
  { abbr: 'May', full: 'May' },
  { abbr: 'Jun', full: 'June' },
  { abbr: 'Jul', full: 'July' },
  { abbr: 'Aug', full: 'August' },
  { abbr: 'Sep', full: 'September' },
  { abbr: 'Oct', full: 'October' },
  { abbr: 'Nov', full: 'November' },
  { abbr: 'Dec', full: 'December' },
];

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

interface ParsedDate {
  year: number;
  month: number;
  day: number;
}

function parseValue(value: string): ParsedDate | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function daysInMonth(year: number, month: number): number {
  // Day 0 of the next month is the last day of this one.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

function formatDisplay(parsed: ParsedDate): string {
  const month = MONTHS[parsed.month - 1];
  return `${month?.abbr ?? parsed.month} ${parsed.day}, ${parsed.year}`;
}

/**
 * A popover birthdate picker: a year grid, then a month grid, then a day-grid
 * calendar. Replaces both the native `<input type="date">` (whose picker
 * always anchors on today, regardless of `min`/`max`, making an older
 * relative's birthdate a long manual scroll) and an earlier year-stepper
 * version — a year *grid*, paged a decade at a time, gets you to a distant
 * year in one or two clicks instead of many single-year steps.
 */
export function BirthDateSelect({
  label,
  value,
  onChange,
  disabled,
}: {
  /** Used to build each control's `aria-label` (e.g. "Birthdate previous years"); there's no single element for an outer `<label for>` to target. */
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const currentYear = new Date().getUTCFullYear();
  const minYear = currentYear - MAX_BIRTH_DATE_AGE_YEARS;
  const today = new Date();
  const defaultMonth = today.getUTCMonth() + 1;

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'year' | 'month' | 'day'>('day');
  const [draftYear, setDraftYear] = useState(currentYear);
  const [draftMonth, setDraftMonth] = useState(defaultMonth);
  const [yearDecadeStart, setYearDecadeStart] = useState(() => Math.floor(currentYear / 10) * 10);

  // Resyncs from an external reset (form cleared, or switched to editing a
  // different record) — the same ref-less "compare to a remembered prop"
  // pattern used elsewhere in this codebase instead of an effect.
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    const parsed = parseValue(value);
    setDraftYear(parsed?.year ?? currentYear);
    setDraftMonth(parsed?.month ?? defaultMonth);
  }

  const parsed = parseValue(value);

  function openYearStep(baseYear: number) {
    setYearDecadeStart(Math.floor(baseYear / 10) * 10);
    setStep('year');
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      if (parsed) {
        setStep('day');
      } else {
        openYearStep(draftYear);
      }
    }
  }

  function selectYear(year: number) {
    setDraftYear(year);
    setStep('month');
  }

  function pageYears(delta: number) {
    setYearDecadeStart((start) => start + delta);
  }

  function selectMonth(month: number) {
    setDraftMonth(month);
    setStep('day');
  }

  function selectDay(day: number) {
    onChange(`${draftYear}-${pad2(draftMonth)}-${pad2(day)}`);
    setOpen(false);
  }

  function stepMonth(delta: number) {
    let month = draftMonth + delta;
    let year = draftYear;
    if (month < 1) {
      month = 12;
      year -= 1;
    } else if (month > 12) {
      month = 1;
      year += 1;
    }
    year = clamp(year, minYear, currentYear);
    setDraftYear(year);
    setDraftMonth(month);
  }

  const maxDay = daysInMonth(draftYear, draftMonth);
  const firstWeekday = new Date(Date.UTC(draftYear, draftMonth - 1, 1)).getUTCDay();
  const monthLabel = MONTHS[draftMonth - 1]?.full ?? '';

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={label}
          className={cn(
            'flex h-11 w-full items-center gap-2 rounded-lg border border-input bg-card px-3.5 text-left text-sm shadow-xs outline-none transition-[color,box-shadow]',
            'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
            'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
          <span className={cn(!parsed && 'text-muted-foreground')}>
            {parsed ? formatDisplay(parsed) : 'Select date'}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3">
        {step === 'year' ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                aria-label={`${label} previous years`}
                disabled={yearDecadeStart <= minYear}
                onClick={() => pageYears(-10)}
                className="rounded-md p-1.5 hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
              >
                <ChevronLeft className="size-4" />
              </button>
              <span className="text-sm font-medium">
                {yearDecadeStart} – {yearDecadeStart + 9}
              </span>
              <button
                type="button"
                aria-label={`${label} next years`}
                disabled={yearDecadeStart + 9 > currentYear}
                onClick={() => pageYears(10)}
                className="rounded-md p-1.5 hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {Array.from({ length: 12 }, (_, i) => yearDecadeStart - 1 + i).map((year) => {
                const outOfRange = year < minYear || year > currentYear;
                const outsideDecade = year < yearDecadeStart || year > yearDecadeStart + 9;
                return (
                  <button
                    key={year}
                    type="button"
                    disabled={outOfRange}
                    onClick={() => selectYear(year)}
                    className={cn(
                      'rounded-md px-2 py-1.5 text-sm hover:bg-accent disabled:pointer-events-none disabled:opacity-40',
                      year === draftYear
                        ? 'bg-primary text-primary-foreground hover:bg-primary'
                        : outsideDecade && 'text-muted-foreground',
                    )}
                  >
                    {year}
                  </button>
                );
              })}
            </div>
          </div>
        ) : step === 'month' ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-center">
              <button
                type="button"
                onClick={() => openYearStep(draftYear)}
                className="rounded-md px-2 py-1 text-sm font-medium hover:bg-accent"
              >
                {draftYear}
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {MONTHS.map((month, index) => (
                <button
                  key={month.abbr}
                  type="button"
                  onClick={() => selectMonth(index + 1)}
                  className={cn(
                    'rounded-md px-2 py-1.5 text-sm hover:bg-accent',
                    draftMonth === index + 1 && parsed?.year === draftYear
                      ? 'border border-primary font-semibold text-primary'
                      : 'border border-transparent',
                  )}
                >
                  {month.abbr}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => stepMonth(-1)}
                className="rounded-md p-1.5 hover:bg-accent"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setStep('month')}
                className="rounded-md px-2 py-1 text-sm font-medium hover:bg-accent"
              >
                {monthLabel} {draftYear}
              </button>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => stepMonth(1)}
                className="rounded-md p-1.5 hover:bg-accent"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
              {WEEKDAYS.map((weekday) => (
                <div key={weekday}>{weekday}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstWeekday }, (_, i) => (
                <div key={`blank-${i}`} />
              ))}
              {Array.from({ length: maxDay }, (_, i) => i + 1).map((day) => {
                const selected =
                  parsed?.year === draftYear && parsed.month === draftMonth && parsed.day === day;
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => selectDay(day)}
                    className={cn(
                      'rounded-md py-1 text-sm hover:bg-accent',
                      selected && 'bg-primary text-primary-foreground hover:bg-primary',
                    )}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
