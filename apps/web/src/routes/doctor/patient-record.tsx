import { Link, useParams, useSearchParams } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDoctorPatientRecord } from '@/lib/records/use-records';
import { formatSlotDateAndTime } from '@/lib/discovery/slot-grouping';
import { QueryState } from '@/components/query-state';
import { relationshipLabel } from '@/lib/dependents/relationship-label';

export function DoctorPatientRecordPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const [searchParams] = useSearchParams();
  const dependentId = searchParams.get('dependentId') ?? undefined;
  const record = useDoctorPatientRecord(patientId, dependentId);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <QueryState query={record} label="this patient record">
        {(data) => (
          <>
            <h1 className="text-2xl font-semibold">
              {data.firstName} {data.lastName}
              {data.relationship && (
                <span className="ml-2 text-base font-normal text-muted-foreground">
                  ({relationshipLabel(data.relationship)})
                </span>
              )}
            </h1>

            <Card>
              <CardHeader>
                <CardTitle>Medical history</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-1 text-sm">
                <p>
                  <span className="font-medium">Age:</span> <span>{data.age ?? 'Unknown'}</span>
                </p>
                <p>
                  <span className="font-medium">Conditions:</span>{' '}
                  <span>{data.medicalConditions ?? 'None recorded'}</span>
                </p>
                <p>
                  <span className="font-medium">Allergies:</span> <span>{data.allergies ?? 'None recorded'}</span>
                </p>
                <p>
                  <span className="font-medium">Medications:</span>{' '}
                  <span>{data.currentMedications ?? 'None recorded'}</span>
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Appointments with you</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {data.appointmentsWithDoctor.length === 0 && (
                  <p className="text-sm text-muted-foreground">No appointments yet.</p>
                )}
                {data.appointmentsWithDoctor.map((appointment) => (
                  <div key={appointment.id} className="flex items-center justify-between text-sm">
                    <span>{formatSlotDateAndTime(appointment.startsAt, timezone)}</span>
                    <Badge variant="outline">{appointment.status}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Past consultations</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {data.completedConsultations.length === 0 && (
                  <p className="text-sm text-muted-foreground">No completed consultations yet.</p>
                )}
                {data.completedConsultations.map((item) => (
                  <Link
                    key={item.appointmentId}
                    to={`/consultations/${item.appointmentId}`}
                    className="flex items-center justify-between gap-2 rounded-md border border-input p-3 text-sm hover:bg-accent/50"
                  >
                    <span>{formatSlotDateAndTime(item.startsAt, timezone)}</span>
                    <span className="text-muted-foreground">Dr. {item.doctor.displayName}</span>
                  </Link>
                ))}
              </CardContent>
            </Card>
          </>
        )}
      </QueryState>
    </div>
  );
}
