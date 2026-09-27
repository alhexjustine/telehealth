import { useState } from 'react';
import { DayPicker } from 'react-day-picker';
import { format, isSameDay } from 'date-fns';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { availabilityWindow, type DayRange } from '@/lib/discovery/availability-date';
import { cn } from '@/lib/utils';

interface AvailabilityDatePickerProps {
  id: string;
  /** The applied range, or `undefined` for any day. */
  value: DayRange | undefined;
  onChange: (range: DayRange | undefined) => void;
}

function formatDayRange(range: DayRange | undefined): string {
  if (!range) return 'Any day';
  if (isSameDay(range.from, range.to)) return format(range.from, 'EEE, MMM d');
  return `${format(range.from, 'MMM d')} – ${format(range.to, 'MMM d')}`;
}

/**
 * A one-month calendar popover (arrows move between months) limited to today and the next 13 days.
 * The first click picks the start day, the second the end day, a third starts over; Apply commits
 * the range (a single day is a start with no second click) and Clear resets to any day.
 */
export function AvailabilityDatePicker({ id, value, onChange }: AvailabilityDatePickerProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DayRange | undefined>(value);
  const [nextClickStarts, setNextClickStarts] = useState(true);
  const { first, last } = availabilityWindow(new Date());

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setDraft(value);
      setNextClickStarts(true);
    }
    setOpen(nextOpen);
  }

  function pickDay(day: Date) {
    if (nextClickStarts || !draft) {
      setDraft({ from: day, to: day });
      setNextClickStarts(false);
    } else {
      setDraft(day < draft.from ? { from: day, to: draft.from } : { from: draft.from, to: day });
      setNextClickStarts(true);
    }
  }

  function commit(range: DayRange | undefined) {
    onChange(range);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          className="min-w-44 justify-start gap-2 font-normal"
          aria-labelledby={`${id}-label ${id}-value`}
        >
          <CalendarDays className="size-4 text-muted-foreground" aria-hidden="true" />
          <span id={`${id}-value`}>{formatDayRange(value)}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[19rem] p-4">
        <DayPicker
          mode="range"
          selected={draft}
          onSelect={(_range, triggerDate) => pickDay(triggerDate)}
          defaultMonth={value?.from ?? first}
          startMonth={first}
          endMonth={last}
          disabled={[{ before: first }, { after: last }]}
          showOutsideDays
          components={{
            Chevron: ({ orientation, className }) =>
              orientation === 'left' ? (
                <ChevronLeft className={cn('size-4', className)} />
              ) : (
                <ChevronRight className={cn('size-4', className)} />
              ),
          }}
          classNames={{
            root: 'relative',
            month: 'flex flex-col gap-3',
            month_caption: 'flex h-9 items-center px-1',
            caption_label: 'font-display text-base font-semibold',
            nav: 'absolute top-0 right-0 flex items-center gap-1',
            button_previous:
              'inline-flex size-9 items-center justify-center rounded-full text-foreground hover:bg-muted disabled:pointer-events-none disabled:opacity-30',
            button_next:
              'inline-flex size-9 items-center justify-center rounded-full text-foreground hover:bg-muted disabled:pointer-events-none disabled:opacity-30',
            month_grid: 'w-full border-collapse',
            weekday: 'h-9 text-xs font-medium text-muted-foreground',
            day: 'p-0.5 text-center',
            day_button:
              'inline-flex size-9 items-center justify-center rounded-full text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none',
            today: '[&>button]:ring-1 [&>button]:ring-foreground/50',
            range_middle: '[&>button]:bg-secondary [&>button]:text-secondary-foreground [&>button]:hover:bg-secondary',
            range_start: '[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary',
            range_end: '[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary',
            outside: '[&>button]:text-muted-foreground',
            disabled: '[&>button]:text-muted-foreground [&>button]:opacity-40',
          }}
        />
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
          <span className="text-sm text-muted-foreground" aria-live="polite">
            {draft ? formatDayRange(draft) : 'Pick a start day'}
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => commit(undefined)}>
              Clear
            </Button>
            <Button type="button" size="sm" disabled={!draft} onClick={() => commit(draft)}>
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
