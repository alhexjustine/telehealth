import { Link, useSearchParams } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { usePatientRecords } from '@/lib/records/use-records';
import { useDependents } from '@/lib/dependents/use-dependents';
import { relationshipLabel } from '@/lib/dependents/relationship-label';
import { formatSlotDateAndTime } from '@/lib/discovery/slot-grouping';
import { QueryState } from '@/components/query-state';

const selectClassName =
  'h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

export function PatientRecordsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const dependentId = searchParams.get('dependentId') ?? undefined;
  const records = usePatientRecords(1, 20, dependentId);
  const dependents = useDependents();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  function updateFilter(value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set('dependentId', value);
    else next.delete('dependentId');
    setSearchParams(next);
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <h1 className="text-2xl font-semibold">Your records</h1>

      {dependents.data && dependents.data.items.length > 0 && (
        <div className="flex flex-col gap-1">
          <Label htmlFor="records-person-filter">Show records for</Label>
          <select
            id="records-person-filter"
            className={selectClassName}
            value={dependentId ?? ''}
            onChange={(event) => updateFilter(event.target.value)}
          >
            <option value="">Everyone</option>
            <option value="self">Myself</option>
            {dependents.data.items.map((dependent) => (
              <option key={dependent.id} value={dependent.id}>
                {dependent.firstName} {dependent.lastName} ({relationshipLabel(dependent.relationship)})
              </option>
            ))}
          </select>
        </div>
      )}

      <QueryState
        query={records}
        label="records"
        isEmpty={(data) => data.items.length === 0}
        empty={
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-muted-foreground">
              You don&apos;t have any completed consultations yet. Records appear here once a doctor
              completes a visit.
            </p>
            <Link to="/patient/find-care" className={buttonVariants({ variant: 'outline' })}>
              Find care
            </Link>
          </div>
        }
      >
        {(data) =>
          data.items.map((item) => (
            <Link key={item.appointmentId} to={`/patient/records/${item.appointmentId}`}>
              <Card className="hover:bg-accent/50">
                <CardContent className="flex items-center justify-between gap-2 pt-6">
                  <div>
                    <p className="font-medium">{formatSlotDateAndTime(item.startsAt, timezone)}</p>
                    <p className="text-sm text-muted-foreground">Dr. {item.doctor.displayName}</p>
                    {item.dependent && (
                      <p className="text-sm text-muted-foreground">
                        For {item.dependent.displayName} ({relationshipLabel(item.dependent.relationship)})
                      </p>
                    )}
                  </div>
                  <Badge variant="secondary">Completed</Badge>
                </CardContent>
              </Card>
            </Link>
          ))
        }
      </QueryState>
    </div>
  );
}
