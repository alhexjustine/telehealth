import { CalendarClock, CalendarDays } from 'lucide-react';
import { useNavigate } from 'react-router';
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
import { HomeActions, type HomeAction } from '@/components/home-actions';
import { AcceptingBookingsToggle } from '@/components/accepting-bookings-toggle';
import { isSameLocalDate } from '@/lib/appointments/is-same-local-date';
import { relationshipLabel } from '@/lib/dependents/relationship-label';

const ACTIONS: HomeAction[] = [
  {
    to: '/doctor/appointments',
    label: 'Appointments',
    description: 'Upcoming and past consultations with your patients.',
    icon: CalendarDays,
  },
  {
    to: '/doctor/schedule',
    label: 'Schedule',
    description: 'Set your weekly hours and block out time off.',
    icon: CalendarClock,
  },
];


export function DoctorHomePage() {
  const navigate = useNavigate();
  const { data: user } = useCurrentUser();
  const profile = useDoctorProfile();
  const availability = useAvailability();
  const upcoming = useAppointments('upcoming');

  const timezone = availability.data?.timezone ?? 'UTC';

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 py-2">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-medium">Welcome{user ? `, ${user.displayName}` : ''}</h1>
        <AcceptingBookingsToggle />
      </div>
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
                    className="flex cursor-pointer flex-col gap-3 rounded-xl border border-border p-4 transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between"
                    onClick={() => void navigate(`/doctor/appointments/${appointment.id}`)}
                  >
                    <div className="flex-1">
                      <p className="font-semibold">
                        {appointment.dependent
                          ? `${appointment.dependent.displayName} (${relationshipLabel(appointment.dependent.relationship)})`
                          : appointment.patient.displayName}
                      </p>
                      <p className="text-sm text-muted-foreground">{appointment.reason}</p>
                    </div>
                    <div className="flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
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

      <HomeActions actions={ACTIONS} />
    </div>
  );
}
