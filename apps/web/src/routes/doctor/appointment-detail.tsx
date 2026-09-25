import { useParams } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAppointment } from '@/lib/appointments/use-appointments';
import { formatSlotDateAndTime } from '@/lib/discovery/slot-grouping';

export function DoctorAppointmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const appointment = useAppointment(id);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  if (appointment.isPending) {
    return <p className="text-muted-foreground">Loading…</p>;
  }
  if (appointment.isError || !appointment.data) {
    return <p className="text-muted-foreground">Appointment not found.</p>;
  }

  const data = appointment.data;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Appointment details</h1>
        <Badge>{data.status}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {data.patient.displayName}
            {data.patient.age !== null ? `, ${data.patient.age}` : ''}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <p className="font-medium">{formatSlotDateAndTime(data.startsAt, timezone)}</p>
          <p className="text-sm">{data.reason}</p>
          {data.symptoms.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {data.symptoms.map((symptom) => (
                <Badge key={symptom.id} variant="secondary">
                  {symptom.name}
                </Badge>
              ))}
            </div>
          )}
          {data.status === 'CANCELLED' && (
            <div className="rounded-md border border-input p-3 text-sm text-muted-foreground">
              Cancelled {data.cancelledAt ? formatSlotDateAndTime(data.cancelledAt, timezone) : ''} by{' '}
              {data.cancelledByRole === 'DOCTOR' ? 'you' : 'the patient'}
              {data.cancellationReason ? `: ${data.cancellationReason}` : '.'}
            </div>
          )}
        </CardContent>
      </Card>

      {data.history.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>History</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {data.history.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between text-sm">
                <span>{formatSlotDateAndTime(entry.startsAt, timezone)}</span>
                <Badge variant={entry.id === data.id ? 'default' : 'outline'}>{entry.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
