import { Link } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { usePatientRecords } from '@/lib/records/use-records';
import { formatSlotDateAndTime } from '@/lib/discovery/slot-grouping';

export function PatientRecordsPage() {
  const records = usePatientRecords();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <h1 className="text-2xl font-semibold">Your records</h1>

      {records.isPending && <p className="text-muted-foreground">Loading…</p>}
      {records.data && records.data.items.length === 0 && (
        <p className="text-muted-foreground">No completed consultations yet.</p>
      )}
      {records.data?.items.map((item) => (
        <Link key={item.appointmentId} to={`/patient/records/${item.appointmentId}`}>
          <Card className="hover:bg-accent/50">
            <CardContent className="flex items-center justify-between gap-2 pt-6">
              <div>
                <p className="font-medium">{formatSlotDateAndTime(item.startsAt, timezone)}</p>
                <p className="text-sm text-muted-foreground">Dr. {item.doctor.displayName}</p>
              </div>
              <Badge variant="secondary">Completed</Badge>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
