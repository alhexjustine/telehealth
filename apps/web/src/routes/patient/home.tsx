import { CalendarDays, FileText, HeartPulse, Search, UserRound } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HomeActions, type HomeAction } from '@/components/home-actions';
import { JoinConsultationButton } from '@/components/join-consultation-button';
import { QueryState } from '@/components/query-state';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import { useAppointments } from '@/lib/appointments/use-appointments';
import { isSameLocalDate } from '@/lib/appointments/is-same-local-date';
import { formatSlotTimeOnly } from '@/lib/discovery/slot-grouping';

const ACTIONS: HomeAction[] = [
  {
    to: '/patient/doctors',
    label: 'Find a doctor',
    description: 'Search by name or specialization and see who is available.',
    icon: Search,
  },
  {
    to: '/patient/find-care',
    label: 'Find care by symptoms',
    description: 'Describe how you feel and get matched to the right specialization.',
    icon: HeartPulse,
  },
  {
    to: '/patient/appointments',
    label: 'Your appointments',
    description: 'Upcoming and past visits — reschedule or cancel from here.',
    icon: CalendarDays,
  },
  {
    to: '/patient/records',
    label: 'Your records',
    description: 'Consultation notes and prescriptions from your doctors.',
    icon: FileText,
  },
];

export function PatientHomePage() {
  const navigate = useNavigate();
  const { data: user } = useCurrentUser();
  // Same page and size as the Appointments page, so both share one cached query.
  const upcoming = useAppointments('upcoming');
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const now = new Date();

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 py-2">
      <h1 className="text-3xl font-medium">Welcome{user ? `, ${user.displayName}` : ''}</h1>

      {user && user.profileComplete === false && (
        <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:gap-5 sm:p-6">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-warm text-warm-foreground">
            <UserRound className="size-6" aria-hidden="true" />
          </span>
          <div className="flex flex-1 flex-col gap-1">
            <h2 className="font-sans text-base font-bold tracking-normal">Complete your profile</h2>
            <p className="text-sm text-muted-foreground">
              Add your birthday, weight, height, and phone number so doctors and staff have what they
              need.
            </p>
          </div>
          <Link to="/patient/profile" className={buttonVariants({ variant: 'default' })}>
            Go to your profile
          </Link>
        </Card>
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
              data.items.filter((appointment) => isSameLocalDate(appointment.startsAt, timezone, now)).length === 0
            }
            empty={
              <p className="text-muted-foreground">
                No appointments today.{' '}
                <Link to="/patient/doctors" className="text-primary underline-offset-4 hover:underline">
                  Find a doctor
                </Link>{' '}
                to book one.
              </p>
            }
          >
            {(data) =>
              data.items
                .filter((appointment) => isSameLocalDate(appointment.startsAt, timezone, now))
                .map((appointment) => (
                  <div
                    key={appointment.id}
                    className="flex cursor-pointer flex-col gap-3 rounded-xl border border-border p-4 transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between"
                    onClick={() => void navigate(`/patient/appointments/${appointment.id}`)}
                  >
                    <div className="flex-1">
                      <p className="font-semibold">{formatSlotTimeOnly(appointment.startsAt, timezone)}</p>
                      <p className="text-sm text-muted-foreground">{appointment.doctor.displayName}</p>
                    </div>
                    <div onClick={(event) => event.stopPropagation()}>
                      <JoinConsultationButton
                        appointmentId={appointment.id}
                        status={appointment.status}
                        startsAt={appointment.startsAt}
                        endsAt={appointment.endsAt}
                      />
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
