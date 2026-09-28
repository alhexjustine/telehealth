import { Link } from 'react-router';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { InitialsAvatar } from '@/components/initials-avatar';
import { RatingSummary } from '@/components/rating-summary';
import { FavoriteToggleButton } from '@/components/favorite-toggle-button';
import { QueryState } from '@/components/query-state';
import { useFavorites } from '@/lib/favorites/use-favorites';
import { formatSlotDateTime } from '@/lib/format-slot-time';

export function PatientFavoritesPage() {
  const favorites = useFavorites();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <h1 className="text-2xl font-semibold">My favorites</h1>
      <QueryState
        query={favorites}
        label="favorites"
        isEmpty={(data) => data.items.length === 0}
        empty={
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <p className="text-muted-foreground">You haven&apos;t favorited any doctors yet.</p>
              <Link to="/patient/doctors" className="text-primary underline-offset-4 hover:underline">
                Find a doctor
              </Link>
            </CardContent>
          </Card>
        }
      >
        {(data) => (
          <div className="flex flex-col gap-3">
            {data.items.map((doctor) => (
              <Card key={doctor.id}>
                <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:gap-5 sm:p-6">
                  <div className="flex flex-1 items-center gap-4 sm:gap-5">
                    <InitialsAvatar name={doctor.displayName} className="size-14" />
                    <div className="flex flex-1 flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-xl">{doctor.displayName}</CardTitle>
                        <FavoriteToggleButton doctorId={doctor.id} isFavorited stopPropagation={false} />
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {doctor.specializations.map((s) => (
                          <Badge key={s.id} variant="secondary">
                            {s.name}
                          </Badge>
                        ))}
                      </div>
                      {doctor.yearsOfExperience !== null && (
                        <p className="text-sm text-muted-foreground">
                          {doctor.yearsOfExperience} years of experience
                        </p>
                      )}
                      <RatingSummary averageRating={doctor.averageRating} reviewCount={doctor.reviewCount} />
                    </div>
                  </div>
                  <div className="flex flex-col items-stretch gap-2 sm:items-end">
                    {!doctor.acceptingBookings ? (
                      <p className="text-sm text-muted-foreground sm:text-right">Not accepting bookings</p>
                    ) : doctor.nextAvailableSlot ? (
                      <p className="text-sm text-muted-foreground sm:text-right">
                        Next available {formatSlotDateTime(doctor.nextAvailableSlot)}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground sm:text-right">No upcoming availability</p>
                    )}
                    <Link
                      to={`/patient/doctors/${doctor.id}`}
                      className={buttonVariants({ variant: 'default', size: 'sm' })}
                    >
                      Book
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </QueryState>
    </div>
  );
}
