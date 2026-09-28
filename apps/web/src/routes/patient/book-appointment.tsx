import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { Check, Plus, X } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import { usePublicDoctorProfile } from '@/lib/discovery/use-doctor-search';
import { useDoctorSlots } from '@/lib/availability/use-availability';
import { useSymptomCatalog } from '@/lib/matching/use-symptoms';
import { useBookAppointment } from '@/lib/appointments/use-appointments';
import { useAddDependent, useDependents, type DependentDto } from '@/lib/dependents/use-dependents';
import { relationshipLabel } from '@/lib/dependents/relationship-label';
import { ageFromBirthDate } from '@/lib/dependents/age';
import { BirthDateSelect } from '@/components/birth-date-select';
import { getApiErrorCode } from '@/lib/api-error';
import { formatSlotDateAndTime } from '@/lib/discovery/slot-grouping';
import { QueryState } from '@/components/query-state';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const REASON_MIN_LENGTH = 10;
const REASON_MAX_LENGTH = 500;
const REFRESH_HORIZON_DAYS = 14;
const NEW_DEPENDENT = '__new__';
const RELATIONSHIPS = ['CHILD', 'PARENT', 'SPOUSE', 'OTHER'] as const;
const selectClassName =
  'h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50';

export function BookAppointmentPage() {
  const { doctorId } = useParams<{ doctorId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const start = searchParams.get('start') ?? '';
  const symptomIds = useMemo(
    () => (searchParams.get('symptoms') ?? '').split(',').filter((id) => id.length > 0),
    [searchParams],
  );
  const dependentParam = searchParams.get('dependent') ?? '';

  const currentUser = useCurrentUser();
  const profile = usePublicDoctorProfile(doctorId);
  const catalog = useSymptomCatalog();
  const bookAppointment = useBookAppointment();
  const dependents = useDependents();

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // `userReason` is `null` until the patient types, so the field displays the
  // symptom-derived default (which updates as the catalog loads) without an
  // effect — an effect that called `setReason` directly on catalog load would
  // itself trigger a second, cascading render.
  const [userReason, setUserReason] = useState<string | null>(null);
  const [selectedSymptomIds, setSelectedSymptomIds] = useState<string[]>(symptomIds);
  const [slotTaken, setSlotTaken] = useState(false);
  const [dependentId, setDependentId] = useState<string>('');

  // Applies a "Book again" `?dependent=` prefill exactly once, as soon as the
  // patient's own dependents list has loaded (so the ID can be validated
  // against it) — falls back to "Myself" if it doesn't match any of the
  // patient's *current* dependents (e.g. later removed). A ref-less
  // alternative to an effect, same pattern used elsewhere in this file/repo:
  // compare against a remembered value instead of re-running on every render.
  const [appliedDependentParam, setAppliedDependentParam] = useState<string | undefined>(undefined);
  if (dependentParam !== '' && dependentParam !== appliedDependentParam && dependents.data) {
    setAppliedDependentParam(dependentParam);
    if (dependents.data.items.some((dependent) => dependent.id === dependentParam)) {
      setDependentId(dependentParam);
    }
  }

  const symptomNamesById = useMemo(() => {
    const map = new Map<string, string>();
    for (const group of catalog.data ?? []) {
      for (const symptom of group.symptoms) {
        map.set(symptom.id, symptom.name);
      }
    }
    return map;
  }, [catalog.data]);

  const defaultReason = useMemo(() => {
    const names = selectedSymptomIds
      .map((id) => symptomNamesById.get(id))
      .filter((name): name is string => !!name);
    return names.length > 0 ? `Symptoms: ${names.join(', ')}. ` : '';
  }, [selectedSymptomIds, symptomNamesById]);

  const reason = userReason ?? defaultReason;

  const refreshRange = useMemo(() => {
    const from = new Date();
    const to = new Date(from.getTime() + REFRESH_HORIZON_DAYS * 24 * 60 * 60 * 1000);
    return { from: from.toISOString(), to: to.toISOString() };
  }, []);
  const refreshedSlots = useDoctorSlots(slotTaken ? doctorId : undefined, refreshRange.from, refreshRange.to);

  function removeSymptom(id: string) {
    setSelectedSymptomIds((prev) => prev.filter((s) => s !== id));
  }

  const profileIncomplete = currentUser.data?.profileComplete === false;
  const reasonValid = reason.trim().length >= REASON_MIN_LENGTH && reason.length <= REASON_MAX_LENGTH;
  const canSubmit =
    !profileIncomplete &&
    reasonValid &&
    start !== '' &&
    dependentId !== NEW_DEPENDENT &&
    !bookAppointment.isPending;

  async function submit() {
    if (!doctorId || !start) return;
    setSlotTaken(false);
    try {
      await bookAppointment.mutateAsync({
        doctorId,
        startsAt: start,
        reason: reason.trim(),
        symptomIds: selectedSymptomIds.length > 0 ? selectedSymptomIds : undefined,
        dependentId: dependentId || undefined,
      });
      toast.success('Appointment booked');
      void navigate('/patient/appointments');
    } catch (error) {
      if (getApiErrorCode(error) === 'SLOT_UNAVAILABLE') {
        setSlotTaken(true);
      } else {
        toast.error(error instanceof Error ? error.message : 'Could not book the appointment');
      }
    }
  }

  if (!start) {
    // Reachable by navigating here directly (a bookmark, a shared link, a refresh that drops the
    // query string) rather than only via the doctor profile's slot picker, which always sets
    // `?start=`. There's nothing to load — showing "Loading…" forever would be a dead end
    // indistinguishable from a stuck request; send the patient back to pick a time instead.
    return (
      <Alert>
        <AlertTitle>No time selected</AlertTitle>
        <AlertDescription>
          <p>Choose an available time on the doctor&apos;s profile to book an appointment.</p>
          {doctorId && (
            <Link
              to={`/patient/doctors/${doctorId}`}
              className="text-primary underline-offset-4 hover:underline"
            >
              Back to doctor profile
            </Link>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Confirm your appointment</h1>

      <QueryState query={profile} label="the doctor's details">
        {(profileData) => (
          <>
      <Card>
        <CardHeader>
          <CardTitle>{profileData.displayName}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          <p className="font-medium">{formatSlotDateAndTime(start, timezone)}</p>
          <p className="text-sm text-muted-foreground">{profileData.consultationMinutes} minutes</p>
        </CardContent>
      </Card>

      {profileIncomplete && (
        <Alert>
          <AlertTitle>Complete your profile first</AlertTitle>
          <AlertDescription>
            We need your birthday, weight, height, and phone number before you can book.{' '}
            <Link to="/patient/profile" className="text-primary underline-offset-4 hover:underline">
              Go to your profile
            </Link>
            .
          </AlertDescription>
        </Alert>
      )}

      {slotTaken && (
        <Alert variant="destructive">
          <AlertTitle>That time was just taken</AlertTitle>
          <AlertDescription>
            <p>Someone else booked this slot. Here are the doctor's current available times.</p>
            {refreshedSlots.data && refreshedSlots.data.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {refreshedSlots.data.slice(0, 12).map((slot) => (
                  <Link
                    key={slot.start}
                    to={`/patient/doctors/${doctorId}/book?start=${encodeURIComponent(slot.start)}&symptoms=${selectedSymptomIds.join(',')}`}
                    className="rounded-md border border-input px-3 py-1 text-sm hover:bg-accent"
                  >
                    {formatSlotDateAndTime(slot.start, timezone)}
                  </Link>
                ))}
              </div>
            ) : (
              <Link
                to={`/patient/doctors/${doctorId}`}
                className="mt-2 inline-block text-primary underline-offset-4 hover:underline"
              >
                See the doctor's other available times
              </Link>
            )}
          </AlertDescription>
        </Alert>
      )}

      {selectedSymptomIds.length > 0 && (
        <div className="flex flex-col gap-2">
          <Label>Symptoms from your search</Label>
          <div className="flex flex-wrap gap-2">
            {selectedSymptomIds.map((id) => (
              <Badge key={id} variant="secondary" className="gap-1">
                {symptomNamesById.get(id) ?? id}
                <button
                  type="button"
                  aria-label={`Remove ${symptomNamesById.get(id) ?? 'symptom'}`}
                  onClick={() => removeSymptom(id)}
                  className="ml-1 text-xs opacity-70 hover:opacity-100"
                >
                  ×
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}

      <Card>
        <CardContent className="flex flex-col gap-3 pt-6">
          <div>
            <h3 className="text-sm font-semibold">Who is this appointment for?</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Choose yourself, a dependent, or add someone new.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <AttendeeOption
              selected={dependentId === ''}
              name={currentUser.data?.displayName ?? 'Myself'}
              subtitle="You"
              onSelect={() => setDependentId('')}
              disabled={profileIncomplete}
            />
            {(dependents.data?.items ?? []).map((dependent) => (
              <AttendeeOption
                key={dependent.id}
                selected={dependentId === dependent.id}
                name={`${dependent.firstName} ${dependent.lastName}`}
                subtitle={`${relationshipLabel(dependent.relationship)} · age ${ageFromBirthDate(dependent.birthDate)}`}
                onSelect={() => setDependentId(dependent.id)}
                disabled={profileIncomplete}
              />
            ))}

            {dependentId !== NEW_DEPENDENT && (
              <button
                type="button"
                onClick={() => setDependentId(NEW_DEPENDENT)}
                disabled={profileIncomplete}
                className="flex items-center gap-2.5 rounded-xl border-[1.5px] border-dashed border-input bg-muted/40 px-4 py-3.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                  <Plus className="size-3.5" strokeWidth={2.5} />
                </span>
                Add someone new
              </button>
            )}
          </div>

          {dependentId === NEW_DEPENDENT && (
            <NewDependentForm
              onAdded={(id) => setDependentId(id)}
              onCancel={() => setDependentId('')}
            />
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-1">
        <Label htmlFor="booking-reason">Reason for visit</Label>
        <Textarea
          id="booking-reason"
          value={reason}
          maxLength={REASON_MAX_LENGTH}
          onChange={(event) => setUserReason(event.target.value)}
          rows={4}
          disabled={profileIncomplete}
        />
        <p className="text-right text-xs text-muted-foreground">
          {reason.length}/{REASON_MAX_LENGTH} (at least {REASON_MIN_LENGTH})
        </p>
      </div>

      <Button type="button" onClick={() => void submit()} disabled={!canSubmit}>
        {bookAppointment.isPending ? 'Booking…' : 'Confirm booking'}
      </Button>
          </>
        )}
      </QueryState>
    </div>
  );
}

/** One selectable row in the "Who is this appointment for?" list — the account holder or a dependent. */
function AttendeeOption({
  selected,
  name,
  subtitle,
  onSelect,
  disabled,
}: {
  selected: boolean;
  name: string;
  subtitle: string;
  onSelect: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        'flex items-center justify-between gap-3 rounded-xl border-[1.5px] px-4 py-3.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        selected ? 'border-primary bg-secondary' : 'border-border bg-card hover:bg-accent/40',
      )}
    >
      <span>
        <span className="block text-sm font-semibold">{name}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{subtitle}</span>
      </span>
      {selected && <Check className="size-5 shrink-0 text-primary" strokeWidth={2.4} />}
    </button>
  );
}

/**
 * A lightweight, inline version of the Dependents page's add form (name,
 * birthdate, relationship only — no medical history), so a patient can book
 * for someone new without leaving the confirmation page. Medical history can
 * still be added afterward from `/patient/dependents`.
 */
function NewDependentForm({ onAdded, onCancel }: { onAdded: (id: string) => void; onCancel: () => void }) {
  const addDependent = useAddDependent();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [relationship, setRelationship] = useState<(typeof RELATIONSHIPS)[number]>('CHILD');

  const valid = firstName.trim().length > 0 && lastName.trim().length > 0 && birthDate !== '';

  async function submit() {
    if (!valid) return;
    try {
      const created: DependentDto = await addDependent.mutateAsync({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        birthDate,
        relationship,
      });
      toast.success('Dependent added');
      onAdded(created.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not add this dependent');
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border-[1.5px] border-primary bg-secondary/40 p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-secondary-foreground">New dependent</span>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel adding a dependent"
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="new-dependent-first-name">First name</Label>
          <Input id="new-dependent-first-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="new-dependent-last-name">Last name</Label>
          <Input id="new-dependent-last-name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <Label>Birthdate</Label>
        <BirthDateSelect label="Birthdate" value={birthDate} onChange={setBirthDate} />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="new-dependent-relationship">Relationship</Label>
        <select
          id="new-dependent-relationship"
          className={selectClassName}
          value={relationship}
          onChange={(e) => setRelationship(e.target.value as (typeof RELATIONSHIPS)[number])}
        >
          {RELATIONSHIPS.map((value) => (
            <option key={value} value={value}>
              {relationshipLabel(value)}
            </option>
          ))}
        </select>
      </div>
      <p className="text-xs text-muted-foreground">
        You can add medical history for them later from your Dependents page.
      </p>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" size="sm" disabled={!valid || addDependent.isPending} onClick={() => void submit()}>
          {addDependent.isPending ? 'Adding…' : 'Add dependent'}
        </Button>
      </div>
    </div>
  );
}
