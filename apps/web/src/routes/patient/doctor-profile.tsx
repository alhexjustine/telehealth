import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { CalendarX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { InitialsAvatar } from '@/components/initials-avatar';
import { RatingSummary } from '@/components/rating-summary';
import { FavoriteToggleButton } from '@/components/favorite-toggle-button';
import { EmptyState } from '@/components/empty-state';
import { usePublicDoctorProfile } from '@/lib/discovery/use-doctor-search';
import { useDoctorSlots } from '@/lib/availability/use-availability';
import { useDoctorReviews } from '@/lib/reviews/use-reviews';
import { useFavorites } from '@/lib/favorites/use-favorites';
import { groupSlotsByLocalDate, formatSlotTimeOnly, formatSlotDateAndTime } from '@/lib/discovery/slot-grouping';
import { QueryState } from '@/components/query-state';

const SLOT_HORIZON_DAYS = 14;

export function PatientDoctorProfilePage() {
  const { doctorId } = useParams<{ doctorId: string }>();
  const [searchParams] = useSearchParams();
  const symptomsParam = searchParams.get('symptoms') ?? '';
  const dependentParam = searchParams.get('dependent') ?? '';
  const profile = usePublicDoctorProfile(doctorId);
  const reviews = useDoctorReviews(doctorId);
  const favorites = useFavorites();
  const isFavorited = doctorId !== undefined && (favorites.data?.items.some((item) => item.id === doctorId) ?? false);

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
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-xl">{profileData.displayName}</CardTitle>
                    {doctorId && (
                      <FavoriteToggleButton doctorId={doctorId} isFavorited={isFavorited} stopPropagation={false} />
                    )}
                  </div>
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
                  <RatingSummary averageRating={profileData.averageRating} reviewCount={profileData.reviewCount} />
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
                    <EmptyState
                      compact
                      icon={CalendarX}
                      description={
                        profileData.acceptingBookings
                          ? `No times are available in the next ${SLOT_HORIZON_DAYS} days.`
                          : "This doctor isn't accepting new bookings right now."
                      }
                      action={{
                        label: `See other ${profileData.specializations[0]?.name ?? ''} doctors`,
                        to: `/patient/doctors?specialization=${encodeURIComponent(profileData.specializations[0]?.slug ?? '')}`,
                      }}
                    />
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
                        to={`/patient/doctors/${doctorId}/book?start=${encodeURIComponent(selectedSlot.start)}${symptomsParam ? `&symptoms=${encodeURIComponent(symptomsParam)}` : ''}${dependentParam ? `&dependent=${encodeURIComponent(dependentParam)}` : ''}`}
                        className={buttonVariants({ variant: 'default' })}
                      >
                        Book
                      </Link>
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Reviews</CardTitle>
              </CardHeader>
              <CardContent>
                <QueryState
                  query={reviews}
                  label="reviews"
                  isEmpty={(data) => data.items.length === 0}
                  empty={<p className="text-muted-foreground">No reviews yet.</p>}
                >
                  {(data) => (
                    <div className="flex flex-col gap-3">
                      {data.items.map((review) => (
                        <div key={review.id} className="border-b border-border pb-3 last:border-0 last:pb-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{review.rating} / 5</span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(review.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          {review.comment && <p className="mt-1 text-sm">{review.comment}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </QueryState>
              </CardContent>
            </Card>
          </>
        )}
      </QueryState>
    </div>
  );
}
