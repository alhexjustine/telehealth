import { Link } from 'react-router';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import { useDoctorProfile } from '@/lib/doctors/use-doctor-profile';
import { useAvailability } from '@/lib/availability/use-availability';
import { useAppointments } from '@/lib/appointments/use-appointments';
import { formatSlotTimeOnly } from '@/lib/discovery/slot-grouping';
import { JoinConsultationButton } from '@/components/join-consultation-button';
import { QueryState } from '@/components/query-state';

/** Whether `iso` falls on `reference`'s calendar date in `timezone`. */
function isSameLocalDate(iso: string, timezone: string, reference: Date): boolean {
  const format = (date: Date) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
      date,
    );
  return format(new Date(iso)) === format(reference);
}

export function DoctorHomePage() {
  const { data: user } = useCurrentUser();
  const profile = useDoctorProfile();
  const availability = useAvailability();
  const upcoming = useAppointments('upcoming');

  const timezone = availability.data?.timezone ?? 'UTC';

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Welcome{user ? `, ${user.displayName}` : ''}</h1>
      {user?.verificationStatus === 'PENDING' && (
        <Alert>
          <AlertTitle>Verification pending</AlertTitle>
          <AlertDescription>
            Your profile is awaiting administrator review and is not yet visible to patients.
          </AlertDescription>
        </Alert>
      )}
      {user?.verificationStatus === 'REJECTED' && (
        <Alert variant="destructive">
          <AlertTitle>Verification rejected</AlertTitle>
          <AlertDescription>
            Your profile was not approved and is not visible to patients.
            {profile.data?.reviewNote && (
              <>
                <br />
                Reviewer note: {profile.data.reviewNote}
              </>
            )}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Today</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <QueryState
            query={upcoming}
            label="today's appointments"
            isEmpty={(data) =>
              data.items.filter((appointment) => isSameLocalDate(appointment.startsAt, timezone, new Date()))
                .length === 0
            }
            empty={<p className="text-muted-foreground">No appointments today.</p>}
          >
            {(data) =>
              data.items
                .filter((appointment) => isSameLocalDate(appointment.startsAt, timezone, new Date()))
                .map((appointment) => (
                  <div
                    key={appointment.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-input p-3 hover:bg-accent/50"
                  >
                    <Link to={`/doctor/appointments/${appointment.id}`} className="flex-1">
                      <p className="font-medium">{appointment.patient.displayName}</p>
                      <p className="text-sm text-muted-foreground">{appointment.reason}</p>
                    </Link>
                    <div className="flex items-center gap-2">
                      <JoinConsultationButton
                        appointmentId={appointment.id}
                        status={appointment.status}
                        startsAt={appointment.startsAt}
                        endsAt={appointment.endsAt}
                      />
                      <Badge variant="outline">{formatSlotTimeOnly(appointment.startsAt, timezone)}</Badge>
                    </div>
                  </div>
                ))
            }
          </QueryState>
        </CardContent>
      </Card>
    </div>
  );
}
