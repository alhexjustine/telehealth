import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { InitialsAvatar } from '@/components/initials-avatar';
import { usePublicDoctorProfile } from '@/lib/discovery/use-doctor-search';
import { useDoctorSlots } from '@/lib/availability/use-availability';
import { groupSlotsByLocalDate, formatSlotTimeOnly, formatSlotDateAndTime } from '@/lib/discovery/slot-grouping';
import { QueryState } from '@/components/query-state';

const SLOT_HORIZON_DAYS = 14;

export function PatientDoctorProfilePage() {
  const { doctorId } = useParams<{ doctorId: string }>();
  const [searchParams] = useSearchParams();
  const symptomsParam = searchParams.get('symptoms') ?? '';
  const profile = usePublicDoctorProfile(doctorId);

  const range = useMemo(() => {
    const from = new Date();
    const to = new Date(from.getTime() + SLOT_HORIZON_DAYS * 24 * 60 * 60 * 1000);
    return { from: from.toISOString(), to: to.toISOString() };
  }, []);
  const slots = useDoctorSlots(doctorId, range.from, range.to);

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const timezoneLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, { timeZoneName: 'short', timeZone: timezone })
        .formatToParts(new Date())
        .find((p) => p.type === 'timeZoneName')?.value ?? timezone,
    [timezone],
  );

  const dayGroups = useMemo(() => groupSlotsByLocalDate(slots.data ?? [], timezone), [slots.data, timezone]);
  const [selectedDateKey, setSelectedDateKey] = useState<string | undefined>(undefined);
  const [selectedSlot, setSelectedSlot] = useState<{ start: string; end: string } | undefined>(undefined);

  const activeDateKey = selectedDateKey ?? dayGroups[0]?.dateKey;
  const activeGroup = dayGroups.find((g) => g.dateKey === activeDateKey);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <QueryState query={profile} label="this doctor's profile">
        {(profileData) => (
          <>
            <Card>
              <CardContent className="flex items-start gap-4 pt-6">
                <InitialsAvatar name={profileData.displayName} className="size-16" />
                <div className="flex flex-1 flex-col gap-2">
                  <CardTitle className="text-xl">{profileData.displayName}</CardTitle>
                  <div className="flex flex-wrap gap-1">
                    {profileData.specializations.map((s) => (
                      <Badge key={s.id} variant="secondary" title={s.description}>
                        {s.name}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {profileData.yearsOfExperience !== null
                      ? `${profileData.yearsOfExperience} years of experience`
                      : 'Experience not listed'}{' '}
                    · {profileData.consultationMinutes}-minute consultations
                  </p>
                  {profileData.bio && <p className="text-sm">{profileData.bio}</p>}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Available times</CardTitle>
                <p className="text-sm text-muted-foreground">Shown in your time zone ({timezoneLabel})</p>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <QueryState
                  query={slots}
                  label="available times"
                  isEmpty={() => dayGroups.length === 0}
                  empty={
                    <div className="flex flex-col gap-2">
                      <p className="text-muted-foreground">
                        No times are available in the next {SLOT_HORIZON_DAYS} days.
                      </p>
                      <Link
                        to={`/patient/doctors?specialization=${encodeURIComponent(profileData.specializations[0]?.slug ?? '')}`}
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        See other {profileData.specializations[0]?.name ?? ''} doctors
                      </Link>
                    </div>
                  }
                >
                  {() => (
                    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Available days">
                      {dayGroups.map((group) => (
                        <button
                          key={group.dateKey}
                          type="button"
                          role="tab"
                          aria-selected={group.dateKey === activeDateKey}
                          onClick={() => setSelectedDateKey(group.dateKey)}
                          className={`rounded-md border px-3 py-2 text-sm ${
                            group.dateKey === activeDateKey
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-input'
                          }`}
                        >
                          <span className="block font-medium">{group.label}</span>
                          <span className="block text-xs opacity-80">{group.slots.length} times</span>
                        </button>
                      ))}
                    </div>
                  )}
                </QueryState>

                {dayGroups.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {activeGroup?.slots.map((slot) => (
                      <Button
                        key={slot.start}
                        type="button"
                        variant={selectedSlot?.start === slot.start ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSelectedSlot(slot)}
                      >
                        {formatSlotTimeOnly(slot.start, timezone)}
                      </Button>
                    ))}
                  </div>
                )}

                {selectedSlot && (
                  <Card data-testid="selected-slot-summary">
                    <CardContent className="flex items-center justify-between gap-4 pt-6">
                      <div>
                        <p className="font-medium">{formatSlotDateAndTime(selectedSlot.start, timezone)}</p>
                        <p className="text-sm text-muted-foreground">
                          {profileData.consultationMinutes} minutes
                        </p>
                      </div>
                      <Link
                        to={`/patient/doctors/${doctorId}/book?start=${encodeURIComponent(selectedSlot.start)}${symptomsParam ? `&symptoms=${encodeURIComponent(symptomsParam)}` : ''}`}
                        className={buttonVariants({ variant: 'default' })}
                      >
                        Book
                      </Link>
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </QueryState>
    </div>
  );
}
