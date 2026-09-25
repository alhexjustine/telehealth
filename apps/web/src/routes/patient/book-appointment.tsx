import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { toast } from 'sonner';
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
import { getApiErrorCode } from '@/lib/api-error';
import { formatSlotDateAndTime } from '@/lib/discovery/slot-grouping';

const REASON_MIN_LENGTH = 10;
const REASON_MAX_LENGTH = 500;
const REFRESH_HORIZON_DAYS = 14;

export function BookAppointmentPage() {
  const { doctorId } = useParams<{ doctorId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const start = searchParams.get('start') ?? '';
  const symptomIds = useMemo(
    () => (searchParams.get('symptoms') ?? '').split(',').filter((id) => id.length > 0),
    [searchParams],
  );

  const currentUser = useCurrentUser();
  const profile = usePublicDoctorProfile(doctorId);
  const catalog = useSymptomCatalog();
  const bookAppointment = useBookAppointment();

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // `userReason` is `null` until the patient types, so the field displays the
  // symptom-derived default (which updates as the catalog loads) without an
  // effect — an effect that called `setReason` directly on catalog load would
  // itself trigger a second, cascading render.
  const [userReason, setUserReason] = useState<string | null>(null);
  const [selectedSymptomIds, setSelectedSymptomIds] = useState<string[]>(symptomIds);
  const [slotTaken, setSlotTaken] = useState(false);

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
  const canSubmit = !profileIncomplete && reasonValid && start !== '' && !bookAppointment.isPending;

  async function submit() {
    if (!doctorId || !start) return;
    setSlotTaken(false);
    try {
      await bookAppointment.mutateAsync({
        doctorId,
        startsAt: start,
        reason: reason.trim(),
        symptomIds: selectedSymptomIds.length > 0 ? selectedSymptomIds : undefined,
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

  if (profile.isPending || !start) {
    return <p className="text-muted-foreground">Loading…</p>;
  }
  if (profile.isError || !profile.data) {
    return <p className="text-muted-foreground">Doctor not found.</p>;
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Confirm your appointment</h1>

      <Card>
        <CardHeader>
          <CardTitle>{profile.data.displayName}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          <p className="font-medium">{formatSlotDateAndTime(start, timezone)}</p>
          <p className="text-sm text-muted-foreground">{profile.data.consultationMinutes} minutes</p>
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
    </div>
  );
}
