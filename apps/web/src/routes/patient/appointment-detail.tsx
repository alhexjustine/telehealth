import { useParams } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAppointment } from '@/lib/appointments/use-appointments';
import { formatSlotDateAndTime } from '@/lib/discovery/slot-grouping';
import { JoinConsultationButton } from '@/components/join-consultation-button';
import { QueryState } from '@/components/query-state';

export function PatientAppointmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const appointment = useAppointment(id);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <QueryState query={appointment} label="this appointment">
        {(data) => (
          <>
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-semibold">Appointment details</h1>
              <Badge>{data.status}</Badge>
            </div>

            <JoinConsultationButton
              appointmentId={data.id}
              status={data.status}
              startsAt={data.startsAt}
              endsAt={data.endsAt}
              size="default"
            />

            <Card>
              <CardHeader>
                <CardTitle>{data.doctor.displayName}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <p className="font-medium">{formatSlotDateAndTime(data.startsAt, timezone)}</p>
                <p className="text-sm text-muted-foreground">
                  {data.doctor.specializations.map((s) => s.name).join(', ')}
                </p>
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
                    {data.cancelledByRole === 'DOCTOR' ? 'the doctor' : 'the patient'}
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
          </>
        )}
      </QueryState>
    </div>
  );
}
