import { useState } from 'react';
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
  AVAILABILITY_PRESETS,
  AVAILABILITY_PRESET_LABELS,
  type AvailabilityPreset,
} from '@/lib/discovery/availability-preset';
import { formatSlotDateTime } from '@/lib/format-slot-time';
import { QueryState } from '@/components/query-state';

const SORT_OPTIONS = [
  { value: 'next', label: 'Soonest available' },
  { value: 'name', label: 'Name' },
  { value: 'experience', label: 'Most experienced' },
] as const;

const selectClassName =
  'h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

export function FindDoctorPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const specializations = useSpecializations();

  const q = searchParams.get('q') ?? '';
  const specialization = searchParams.get('specialization') ?? '';
  const availability = (searchParams.get('availability') as AvailabilityPreset | null) ?? 'any';
  const sort = (searchParams.get('sort') as 'next' | 'name' | 'experience' | null) ?? 'next';
  const page = Number(searchParams.get('page') ?? '1') || 1;

  const [qInput, setQInput] = useState(q);

  const search = useDoctorSearch({ q, specialization, availabilityPreset: availability, sort, page });

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page'); // any filter change resets to page 1
    setSearchParams(next);
  }

  function submitQuery() {
    updateParam('q', qInput);
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
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Find a doctor</h1>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 pt-6">
          <div className="flex flex-col gap-1">
            <Label htmlFor="doctor-search-q">Search</Label>
            <div className="flex gap-2">
              <Input
                id="doctor-search-q"
                placeholder="Name or specialization"
                value={qInput}
                onChange={(e) => setQInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitQuery();
                }}
                className="w-56"
              />
              <Button type="button" variant="outline" onClick={submitQuery}>
                Search
              </Button>
            </div>
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
            <Label htmlFor="doctor-search-availability">Available</Label>
            <select
              id="doctor-search-availability"
              className={selectClassName}
              value={availability}
              onChange={(e) => updateParam('availability', e.target.value)}
            >
              {AVAILABILITY_PRESETS.map((preset) => (
                <option key={preset} value={preset}>
                  {AVAILABILITY_PRESET_LABELS[preset]}
                </option>
              ))}
            </select>
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
            <Link key={doctor.id} to={`/patient/doctors/${doctor.id}`}>
              <Card className="transition-colors hover:bg-accent/50">
                <CardContent className="flex items-center gap-4 pt-6">
                  <InitialsAvatar name={doctor.displayName} className="size-12" />
                  <div className="flex flex-1 flex-col gap-1">
                    <CardTitle className="text-base">{doctor.displayName}</CardTitle>
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
                  <div className="text-right text-sm">
                    {doctor.nextAvailableSlot ? (
                      <>
                        <p className="font-medium">Next available</p>
                        <p className="text-muted-foreground">{formatSlotDateTime(doctor.nextAvailableSlot)}</p>
                      </>
                    ) : (
                      <p className="text-muted-foreground">No upcoming availability</p>
                    )}
                  </div>
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
