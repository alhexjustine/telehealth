import { useCurrentUser } from '@/lib/auth/use-current-user';
import { useAdminDashboard } from '@/lib/admin/use-admin-dashboard';
import { StatTile } from '@/components/admin/stat-tile';
import { TrendChart } from '@/components/admin/trend-chart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { QueryState } from '@/components/query-state';

export function AdminDashboardPage() {
  const { data: user } = useCurrentUser();
  const dashboard = useAdminDashboard();

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Welcome{user ? `, ${user.displayName}` : ''}</h1>
        <p className="text-muted-foreground">An operational snapshot of the platform, computed live.</p>
      </div>

      <QueryState query={dashboard} label="the dashboard">
        {(data) => (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              <StatTile
                label="Pending doctor reviews"
                value={data.pendingDoctorReviews}
                href="/admin/doctors?verification=PENDING"
              />
              <StatTile
                label="Invalid bookings"
                value={data.invalidBookings}
                href="/admin/appointments?invalidOnly=true"
              />
              <StatTile label="Consultations in progress" value={data.consultationsInProgress} />
              <StatTile label="Completed today" value={data.consultationsCompletedToday} />
              <StatTile label="Completed, last 7 days" value={data.consultationsCompletedLast7Days} />
              <StatTile
                label="Active patients"
                value={data.patients.ACTIVE}
                sublabel={`${data.patients.SUSPENDED} suspended, ${data.patients.DEACTIVATED} deactivated`}
              />
              <StatTile
                label="Active doctors"
                value={data.doctors.ACTIVE}
                sublabel={`${data.doctors.SUSPENDED} suspended, ${data.doctors.DEACTIVATED} deactivated`}
              />
              <StatTile
                label="Booked appointments today"
                value={data.appointmentsToday.BOOKED}
                sublabel={`${data.appointmentsUpcoming.BOOKED} upcoming in total`}
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Appointments per day</CardTitle>
              </CardHeader>
              <CardContent>
                <TrendChart buckets={data.trend} />
              </CardContent>
            </Card>
          </>
        )}
      </QueryState>
    </div>
  );
}
