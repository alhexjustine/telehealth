import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { toast } from 'sonner';
import type { ApiPaths } from 'api-client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getApiErrorCode, getApiErrorDetails } from '@/lib/api-error';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import { useDoctorProfile } from '@/lib/doctors/use-doctor-profile';
import {
  useAddTimeOff,
  useAvailability,
  useDeleteTimeOff,
  useDoctorSlots,
  useSaveAvailability,
} from '@/lib/availability/use-availability';
import {
  buildScheduleSchema,
  formatMinuteOfDay,
  getSupportedTimeZones,
  MINUTE_OF_DAY_OPTIONS,
  WEEKDAYS,
  WEEKDAY_LABELS,
  type ScheduleFormValues,
} from '@/lib/availability/schedule-schema';
import { localDateTimeToUtcIso, utcIsoToLocalDateTime } from '@/lib/availability/time-off-conversion';
import { formatSlotTimeOnly, groupSlotsByLocalDate } from '@/lib/discovery/slot-grouping';
import { QueryState } from '@/components/query-state';

type TimeOffDto =
  ApiPaths['/doctors/me/availability']['get']['responses'][200]['content']['application/json']['timeOff'][number];
type SlotDto =
  ApiPaths['/doctors/{doctorId}/slots']['get']['responses'][200]['content']['application/json'][number];

const DEFAULT_RANGE = { startMinute: 9 * 60, endMinute: 10 * 60 };
const COPY_TARGET_WEEKDAYS = [2, 3, 4, 5]; // Tuesday - Friday
const PREVIEW_DAYS = 7;

interface ConflictingAppointment {
  id: string;
  startsAt: string;
  endsAt: string;
  patientName: string;
}

/** Reads the `SCHEDULE_CONFLICTS_WITH_BOOKINGS` error's `details.appointments`, when present. */
function conflictingAppointmentsFrom(error: unknown): ConflictingAppointment[] {
  if (getApiErrorCode(error) !== 'SCHEDULE_CONFLICTS_WITH_BOOKINGS') return [];
  const details = getApiErrorDetails(error) as { appointments?: ConflictingAppointment[] } | undefined;
  return details?.appointments ?? [];
}

function ScheduleConflictsAlert({ appointments }: { appointments: ConflictingAppointment[] }) {
  if (appointments.length === 0) return null;
  return (
    <Alert variant="destructive" data-testid="schedule-conflicts">
      <AlertTitle>This conflicts with existing bookings</AlertTitle>
      <AlertDescription>
        <p>Cancel these appointments first, or choose a change that still covers them:</p>
        <ul className="mt-1 flex flex-col gap-1">
          {appointments.map((appointment) => (
            <li key={appointment.id}>
              <Link
                to={`/doctor/appointments/${appointment.id}`}
                className="text-primary underline-offset-4 hover:underline"
              >
                {appointment.patientName} —{' '}
                {new Intl.DateTimeFormat(undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                }).format(new Date(appointment.startsAt))}
              </Link>
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}

const selectClassName =
  'h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

export function DoctorSchedulePage() {
  const currentUser = useCurrentUser();
  const profile = useDoctorProfile();
  const availability = useAvailability();
  const saveAvailability = useSaveAvailability();
  const addTimeOff = useAddTimeOff();
  const deleteTimeOff = useDeleteTimeOff();

  const consultationMinutes = profile.data?.consultationMinutes ?? 30;
  const schema = useMemo(() => buildScheduleSchema(consultationMinutes), [consultationMinutes]);

  const form = useForm<ScheduleFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { timezone: 'UTC', rules: [] },
  });
  const rulesArray = useFieldArray({ control: form.control, name: 'rules' });

  useEffect(() => {
    if (!availability.data) return;
    // The time zone still reads as its never-saved default, so preselect the
    // browser's own time zone rather than defaulting a new doctor to UTC.
    const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const stillDefault = availability.data.timezone === 'UTC' && availability.data.rules.length === 0;
    form.reset({
      timezone: stillDefault ? browserTimezone : availability.data.timezone,
      rules: availability.data.rules,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when fresh server data arrives
  }, [availability.data]);

  const timezone = form.watch('timezone');
  const rules = form.watch('rules');

  const previewRange = useMemo(() => {
    const from = new Date();
    const to = new Date(from.getTime() + PREVIEW_DAYS * 24 * 60 * 60 * 1000);
    return { from: from.toISOString(), to: to.toISOString() };
  }, []);
  const slots = useDoctorSlots(currentUser.data?.id, previewRange.from, previewRange.to);

  const [scheduleConflicts, setScheduleConflicts] = useState<ConflictingAppointment[]>([]);

  async function onSubmit(values: ScheduleFormValues) {
    try {
      await saveAvailability.mutateAsync(values);
      setScheduleConflicts([]);
      toast.success('Schedule saved');
    } catch (error) {
      const conflicts = conflictingAppointmentsFrom(error);
      setScheduleConflicts(conflicts);
      if (conflicts.length === 0) {
        toast.error(error instanceof Error ? error.message : 'Could not save your schedule');
      }
    }
  }

  function addRange(weekday: number) {
    rulesArray.append({ weekday, ...DEFAULT_RANGE });
  }

  function copyMondayToWeekdays() {
    const mondayRanges = form
      .getValues('rules')
      .filter((rule) => rule.weekday === 1)
      .map((rule) => ({ startMinute: rule.startMinute, endMinute: rule.endMinute }));

    const targetIndexes = rulesArray.fields
      .map((field, index) => ({ index, weekday: field.weekday }))
      .filter(({ weekday }) => COPY_TARGET_WEEKDAYS.includes(weekday))
      .map(({ index }) => index)
      .sort((a, b) => b - a); // remove from the end so earlier indexes stay valid
    for (const index of targetIndexes) rulesArray.remove(index);

    for (const weekday of COPY_TARGET_WEEKDAYS) {
      for (const range of mondayRanges) {
        rulesArray.append({ weekday, ...range });
      }
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Schedule</h1>

      <QueryState query={availability} label="your schedule">
        {() => (
          <>
      <Card>
        <CardHeader>
          <CardTitle>Time zone</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          <Label htmlFor="timezone-input">Time zone</Label>
          <Input
            id="timezone-input"
            list="timezone-options"
            value={timezone}
            onChange={(event) =>
              form.setValue('timezone', event.target.value, { shouldValidate: true })
            }
            className="max-w-xs"
          />
          <datalist id="timezone-options">
            {getSupportedTimeZones().map((tz) => (
              <option key={tz} value={tz} />
            ))}
          </datalist>
          {form.formState.errors.timezone && (
            <p className="text-sm text-destructive" role="alert">
              {form.formState.errors.timezone.message}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Weekly hours</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={copyMondayToWeekdays}>
            Copy Monday to weekdays
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {WEEKDAYS.map((weekday) => (
            <div key={weekday} className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">{WEEKDAY_LABELS[weekday]}</span>
                <Button type="button" variant="outline" size="sm" onClick={() => addRange(weekday)}>
                  Add range
                </Button>
              </div>
              {rulesArray.fields
                .map((field, index) => ({ field, index }))
                .filter(({ field }) => field.weekday === weekday)
                .map(({ field, index }) => {
                  const rangeErrors = form.formState.errors.rules?.[index];
                  const rule = rules[index]!;
                  const rangeMinutes = rule.endMinute - rule.startMinute;
                  const tooShort = rangeMinutes > 0 && rangeMinutes < consultationMinutes;
                  const errorMessage = rangeErrors?.startMinute?.message ?? rangeErrors?.endMinute?.message;
                  return (
                    <div
                      key={field.id}
                      data-testid={`range-${weekday}-${index}`}
                      className="flex flex-wrap items-center gap-2"
                    >
                      <select
                        aria-label={`${WEEKDAY_LABELS[weekday]} range ${index + 1} start`}
                        className={selectClassName}
                        value={rule.startMinute}
                        onChange={(event) =>
                          form.setValue(`rules.${index}.startMinute`, Number(event.target.value), {
                            shouldValidate: true,
                          })
                        }
                      >
                        {MINUTE_OF_DAY_OPTIONS.map((minute) => (
                          <option key={minute} value={minute}>
                            {formatMinuteOfDay(minute)}
                          </option>
                        ))}
                      </select>
                      <span className="text-sm text-muted-foreground">to</span>
                      <select
                        aria-label={`${WEEKDAY_LABELS[weekday]} range ${index + 1} end`}
                        className={selectClassName}
                        value={rule.endMinute}
                        onChange={(event) =>
                          form.setValue(`rules.${index}.endMinute`, Number(event.target.value), {
                            shouldValidate: true,
                          })
                        }
                      >
                        {MINUTE_OF_DAY_OPTIONS.map((minute) => (
                          <option key={minute} value={minute}>
                            {formatMinuteOfDay(minute)}
                          </option>
                        ))}
                      </select>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => rulesArray.remove(index)}
                      >
                        Remove
                      </Button>
                      {errorMessage && (
                        <span className="text-sm text-destructive" role="alert">
                          {errorMessage}
                        </span>
                      )}
                      {!errorMessage && tooShort && (
                        <span className="text-sm text-amber-600" role="status">
                          Shorter than one {consultationMinutes}-minute consultation
                        </span>
                      )}
                    </div>
                  );
                })}
              {rulesArray.fields.every((field) => field.weekday !== weekday) && (
                <p className="text-sm text-muted-foreground">No hours set.</p>
              )}
            </div>
          ))}
          <ScheduleConflictsAlert appointments={scheduleConflicts} />
          <Button
            type="button"
            onClick={() => void form.handleSubmit(onSubmit)()}
            disabled={saveAvailability.isPending}
          >
            {saveAvailability.isPending ? 'Saving…' : 'Save schedule'}
          </Button>
        </CardContent>
      </Card>

      <TimeOffSection
        timezone={timezone}
        timeOff={availability.data?.timeOff ?? []}
        onAdd={addTimeOff}
        onDelete={deleteTimeOff}
      />

      <Card data-testid="slot-preview-card">
        <CardHeader>
          <CardTitle>Next 7 days</CardTitle>
        </CardHeader>
        <CardContent>
          <QueryState
            query={slots}
            label="your upcoming slots"
            isEmpty={(data) => data.length === 0}
            empty={<p className="text-muted-foreground">No upcoming slots.</p>}
          >
            {(data) => <SlotPreview slots={data} timezone={timezone} />}
          </QueryState>
        </CardContent>
      </Card>
          </>
        )}
      </QueryState>
    </div>
  );
}

function TimeOffSection({
  timezone,
  timeOff,
  onAdd,
  onDelete,
}: {
  timezone: string;
  timeOff: TimeOffDto[];
  onAdd: ReturnType<typeof useAddTimeOff>;
  onDelete: ReturnType<typeof useDeleteTimeOff>;
}) {
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [reason, setReason] = useState('');
  const [conflicts, setConflicts] = useState<ConflictingAppointment[]>([]);

  async function handleAdd() {
    if (!startsAt || !endsAt) return;
    try {
      await onAdd.mutateAsync({
        startsAt: localDateTimeToUtcIso(startsAt, timezone),
        endsAt: localDateTimeToUtcIso(endsAt, timezone),
        reason: reason.trim() === '' ? undefined : reason.trim(),
      });
      setStartsAt('');
      setEndsAt('');
      setReason('');
      setConflicts([]);
      toast.success('Time off added');
    } catch (error) {
      const found = conflictingAppointmentsFrom(error);
      setConflicts(found);
      if (found.length === 0) {
        toast.error(error instanceof Error ? error.message : 'Could not add time off');
      }
    }
  }

  async function handleDelete(id: string) {
    try {
      await onDelete.mutateAsync(id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not delete time off');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Time off</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ul className="flex flex-col gap-2">
          {timeOff.map((entry) => (
            <li key={entry.id} className="flex items-center justify-between gap-2 text-sm">
              <span>
                {utcIsoToLocalDateTime(entry.startsAt, timezone)} –{' '}
                {utcIsoToLocalDateTime(entry.endsAt, timezone)}
                {entry.reason ? ` (${entry.reason})` : ''}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleDelete(entry.id)}
              >
                Delete
              </Button>
            </li>
          ))}
          {timeOff.length === 0 && <li className="text-muted-foreground">No upcoming time off.</li>}
        </ul>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="time-off-start">Starts</Label>
            <Input
              id="time-off-start"
              type="datetime-local"
              value={startsAt}
              onChange={(event) => setStartsAt(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="time-off-end">Ends</Label>
            <Input
              id="time-off-end"
              type="datetime-local"
              value={endsAt}
              onChange={(event) => setEndsAt(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="time-off-reason">Reason (optional)</Label>
            <Input
              id="time-off-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
          <Button type="button" onClick={() => void handleAdd()} disabled={onAdd.isPending}>
            Add time off
          </Button>
        </div>
        <ScheduleConflictsAlert appointments={conflicts} />
      </CardContent>
    </Card>
  );
}

function SlotPreview({ slots, timezone }: { slots: SlotDto[]; timezone: string }) {
  const grouped = useMemo(() => groupSlotsByLocalDate(slots, timezone), [slots, timezone]);

  return (
    <div className="flex flex-col gap-5">
      {grouped.map((day) => (
        <div key={day.dateKey} className="flex flex-col gap-2.5">
          <p className="font-display text-base font-semibold">{day.label}</p>
          <div className="flex flex-wrap gap-2">
            {day.slots.map((slot) => (
              <span
                key={slot.start}
                className="rounded-lg bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground"
              >
                {formatSlotTimeOnly(slot.start, timezone)}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
