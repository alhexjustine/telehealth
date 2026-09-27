import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { InitialsAvatar } from '@/components/initials-avatar';
import { useSpecializations } from '@/lib/use-specializations';
import { useDoctorSearch } from '@/lib/discovery/use-doctor-search';
import {
  formatAvailabilityDate,
  parseAvailabilityRange,
  type DayRange,
} from '@/lib/discovery/availability-date';
import { AvailabilityDatePicker } from '@/components/availability-date-picker';
import { formatSlotDateTime } from '@/lib/format-slot-time';
import { QueryState } from '@/components/query-state';

const SORT_OPTIONS = [
  { value: 'next', label: 'Soonest available' },
  { value: 'experience', label: 'Most experienced' },
] as const;

// Long enough that a search isn't fired on every keystroke, short enough to feel live.
const SEARCH_DEBOUNCE_MS = 300;

const selectClassName =
  'h-11 rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

export function FindDoctorPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const specializations = useSpecializations();

  const q = searchParams.get('q') ?? '';
  const specialization = searchParams.get('specialization') ?? '';
  const availability = parseAvailabilityRange(searchParams.get('from'), searchParams.get('to'), new Date());
  const sort = (searchParams.get('sort') as 'next' | 'name' | 'experience' | null) ?? 'next';
  const page = Number(searchParams.get('page') ?? '1') || 1;

  const [qInput, setQInput] = useState(q);

  const search = useDoctorSearch({
    q,
    specialization,
    availability: availability
      ? { from: formatAvailabilityDate(availability.from), to: formatAvailabilityDate(availability.to) }
      : undefined,
    sort,
    page,
  });

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page'); // any filter change resets to page 1
    setSearchParams(next);
  }

  useEffect(() => {
    const term = qInput.trim();
    if (term === q) return;
    const timer = setTimeout(() => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (term) next.set('q', term);
          else next.delete('q');
          next.delete('page');
          return next;
        },
        { replace: true },
      );
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [qInput, q, setSearchParams]);

  function updateAvailability(range: DayRange | undefined) {
    const next = new URLSearchParams(searchParams);
    if (range) {
      next.set('from', formatAvailabilityDate(range.from));
      next.set('to', formatAvailabilityDate(range.to));
    } else {
      next.delete('from');
      next.delete('to');
    }
    next.delete('page');
    setSearchParams(next);
  }

  function setPage(nextPage: number) {
    const next = new URLSearchParams(searchParams);
    if (nextPage <= 1) next.delete('page');
    else next.set('page', String(nextPage));
    setSearchParams(next);
  }

  const total = search.data?.total ?? 0;
  const pageSize = search.data?.pageSize ?? 12;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 py-2">
      <h1 className="text-3xl font-medium">Find a doctor</h1>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 p-5 sm:p-6">
          <div className="flex w-full flex-col gap-1 sm:w-auto">
            <Label htmlFor="doctor-search-q">Search</Label>
            <Input
              id="doctor-search-q"
              type="search"
              placeholder="Name or specialization"
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              className="sm:w-72"
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="doctor-search-specialization">Specialization</Label>
            <select
              id="doctor-search-specialization"
              className={selectClassName}
              value={specialization}
              onChange={(e) => updateParam('specialization', e.target.value)}
            >
              <option value="">All specializations</option>
              {specializations.data?.map((s) => (
                <option key={s.id} value={s.slug}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <Label id="doctor-search-date-label" htmlFor="doctor-search-date">
              Available on
            </Label>
            <AvailabilityDatePicker
              id="doctor-search-date"
              value={availability}
              onChange={updateAvailability}
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="doctor-search-sort">Sort by</Label>
            <select
              id="doctor-search-sort"
              className={selectClassName}
              value={sort}
              onChange={(e) => updateParam('sort', e.target.value)}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <QueryState
        query={search}
        label="doctors"
        isEmpty={(data) => data.items.length === 0}
        empty={
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <p className="text-muted-foreground">No doctors match your search.</p>
              <Link to="/patient/find-care" className="text-primary underline-offset-4 hover:underline">
                Not sure what you need? Try guided symptom matching.
              </Link>
            </CardContent>
          </Card>
        }
      >
        {(data) => (
        <div className="flex flex-col gap-3">
          {data.items.map((doctor) => (
            <Link
              key={doctor.id}
              to={`/patient/doctors/${doctor.id}`}
              className="group rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Card className="transition-colors group-hover:border-primary">
                <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:gap-5 sm:p-6">
                  <div className="flex flex-1 items-center gap-4 sm:gap-5">
                    <InitialsAvatar name={doctor.displayName} className="size-14" />
                    <div className="flex flex-1 flex-col gap-1.5">
                      <CardTitle className="text-xl">{doctor.displayName}</CardTitle>
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
                    </div>
                  </div>
                  {!doctor.acceptingBookings ? (
                    <div className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground sm:min-w-44 sm:text-right">
                      <p>Not accepting bookings</p>
                    </div>
                  ) : doctor.nextAvailableSlot ? (
                    <div className="rounded-xl bg-secondary px-4 py-3 text-sm text-secondary-foreground sm:min-w-44 sm:text-right">
                      <p className="font-semibold">Next available</p>
                      <p>{formatSlotDateTime(doctor.nextAvailableSlot)}</p>
                    </div>
                  ) : (
                    <div className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground sm:min-w-44 sm:text-right">
                      <p>No upcoming availability</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </div>
        )}
      </QueryState>
    </div>
  );
}
