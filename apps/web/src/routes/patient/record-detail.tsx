import { useParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePatientRecord } from '@/lib/records/use-records';
import { formatSlotDateAndTime } from '@/lib/discovery/slot-grouping';
import { QueryState } from '@/components/query-state';

/** Print-friendly (`@media print`, via Tailwind's `print:` variant): the role header is hidden in `RoleAreaLayout`, and this page is already a single column. */
export function PatientRecordDetailPage() {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const record = usePatientRecord(appointmentId);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <QueryState query={record} label="this record">
        {(data) => (
          <>
            <div className="flex items-center justify-between print:hidden">
              <h1 className="text-2xl font-semibold">Consultation record</h1>
              <Button type="button" variant="outline" onClick={() => window.print()}>
                Print
              </Button>
            </div>

            <div>
              <p className="text-lg font-medium">{formatSlotDateAndTime(data.startsAt, timezone)}</p>
              <p className="text-muted-foreground">Dr. {data.doctor.displayName}</p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent className="whitespace-pre-wrap text-sm">
                {data.note?.patientSummary || 'No summary was recorded.'}
              </CardContent>
            </Card>

            {(data.note?.findings || data.note?.assessment || data.note?.plan) && (
              <Card>
                <CardHeader>
                  <CardTitle>Clinical notes</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 text-sm">
                  {data.note?.findings && (
                    <div>
                      <p className="font-medium">Findings</p>
                      <p className="whitespace-pre-wrap text-muted-foreground">{data.note.findings}</p>
                    </div>
                  )}
                  {data.note?.assessment && (
                    <div>
                      <p className="font-medium">Assessment</p>
                      <p className="whitespace-pre-wrap text-muted-foreground">{data.note.assessment}</p>
                    </div>
                  )}
                  {data.note?.plan && (
                    <div>
                      <p className="font-medium">Plan</p>
                      <p className="whitespace-pre-wrap text-muted-foreground">{data.note.plan}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Prescriptions</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm">
                {data.prescriptions.length === 0 && <p className="text-muted-foreground">No prescriptions.</p>}
                {data.prescriptions.map((prescription) => (
                  <div key={prescription.id} className="border-b border-border pb-2 last:border-0">
                    <p className="font-medium">
                      {prescription.medication} — {prescription.dosage}
                    </p>
                    <p className="text-muted-foreground">
                      {prescription.frequency} · {prescription.duration}
                    </p>
                    {prescription.instructions && (
                      <p className="text-muted-foreground">{prescription.instructions}</p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </>
        )}
      </QueryState>
    </div>
  );
}
