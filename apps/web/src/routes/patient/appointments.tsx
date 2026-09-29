import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import type { ApiPaths } from 'api-client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  useAppointments,
  useCancelAppointment,
  useRescheduleAppointment,
} from '@/lib/appointments/use-appointments';
import { useDoctorSlots } from '@/lib/availability/use-availability';
import {
  formatSlotDateAndTime,
  formatSlotTimeOnly,
  groupSlotsByLocalDate,
} from '@/lib/discovery/slot-grouping';
import { JoinConsultationButton } from '@/components/join-consultation-button';
import { QueryState } from '@/components/query-state';
import { Pagination } from '@/components/pagination';
import { buttonVariants } from '@/components/ui/button';
import { relationshipLabel } from '@/lib/dependents/relationship-label';

type AppointmentDto =
  ApiPaths['/appointments']['get']['responses'][200]['content']['application/json']['items'][number];

const PAGE_SIZE = 5;
const RESCHEDULE_HORIZON_DAYS = 14;
const RESCHEDULE_CUTOFF_MINUTES = 120;

function statusVariant(status: AppointmentDto['status']): 'default' | 'secondary' | 'outline' {
  if (status === 'BOOKED') return 'default';
  if (status === 'CANCELLED') return 'outline';
  return 'secondary';
}

export function PatientAppointmentsPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [pages, setPages] = useState({ upcoming: 1, past: 1 });
  const upcoming = useAppointments('upcoming', pages.upcoming, PAGE_SIZE);
  const past = useAppointments('past', pages.past, PAGE_SIZE);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const [rescheduleTarget, setRescheduleTarget] = useState<AppointmentDto | undefined>(undefined);
  const [cancelTarget, setCancelTarget] = useState<AppointmentDto | undefined>(undefined);
  // Captured once per render (not read inside the .map() below) so the
  // "now" comparison stays a pure render computation.
  const now = useMemo(() => new Date().getTime(), []);

  const activeQuery = tab === 'upcoming' ? upcoming : past;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Your appointments</h1>

      <Tabs value={tab} onValueChange={(value) => setTab(value as 'upcoming' | 'past')}>
        <TabsList>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="past">Past</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4 flex flex-col gap-3">
          <QueryState
            query={activeQuery}
            label={`${tab} appointments`}
            isEmpty={(data) => data.items.length === 0}
            empty={
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <p className="text-muted-foreground">
                  {tab === 'upcoming'
                    ? "You don't have any upcoming appointments yet."
                    : "You don't have any past appointments yet."}
                </p>
                <Link to="/patient/find-care" className={buttonVariants({ variant: 'outline' })}>
                  Find care
                </Link>
              </div>
            }
          >
            {(data) => (
              <>
                {data.items.map((appointment) => {
                  const minutesUntilStart =
                    (new Date(appointment.startsAt).getTime() - now) / 60_000;
                  const isUpcoming =
                    appointment.status === 'BOOKED' &&
                    new Date(appointment.startsAt).getTime() > now;
                  const canReschedule =
                    appointment.status === 'BOOKED' &&
                    minutesUntilStart >= RESCHEDULE_CUTOFF_MINUTES;
                  const canCancel = appointment.status === 'BOOKED' && minutesUntilStart > 0;

                  return (
                    <Card key={appointment.id} className="transition-shadow hover:shadow-md">
                      <CardContent
                        className="flex cursor-pointer flex-col gap-4 pt-6"
                        onClick={() => void navigate(`/patient/appointments/${appointment.id}`)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-display text-lg font-semibold">
                              {formatSlotDateAndTime(appointment.startsAt, timezone)}
                            </span>
                            <p className="font-medium">{appointment.doctor.displayName}</p>
                            {appointment.dependent && (
                              <p className="text-xs text-muted-foreground">
                                For {appointment.dependent.displayName} (
                                {relationshipLabel(appointment.dependent.relationship)})
                              </p>
                            )}
                          </div>
                          <Badge variant={statusVariant(appointment.status)}>
                            {appointment.status}
                          </Badge>
                        </div>

                        <p className="text-sm text-muted-foreground">{appointment.reason}</p>

                        <div
                          className="flex flex-wrap items-center gap-2 border-t border-border pt-4"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <JoinConsultationButton
                            appointmentId={appointment.id}
                            status={appointment.status}
                            startsAt={appointment.startsAt}
                            endsAt={appointment.endsAt}
                          />
                          <div className="flex flex-wrap gap-2 sm:ml-auto">
                            {isUpcoming && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={!canReschedule}
                                title={
                                  canReschedule
                                    ? undefined
                                    : 'Rescheduling closes 2 hours before the appointment starts'
                                }
                                onClick={() => setRescheduleTarget(appointment)}
                              >
                                Reschedule
                              </Button>
                            )}
                            {!isUpcoming && (
                              <Link
                                to={`/patient/doctors/${appointment.doctor.id}?dependent=${appointment.dependent?.id ?? ''}`}
                                className={buttonVariants({ variant: 'outline', size: 'sm' })}
                              >
                                Book again
                              </Link>
                            )}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
                              disabled={!canCancel}
                              title={
                                canCancel
                                  ? undefined
                                  : 'This appointment can no longer be cancelled'
                              }
                              onClick={() => setCancelTarget(appointment)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                <Pagination
                  page={data.page}
                  pageSize={data.pageSize}
                  total={data.total}
                  onPageChange={(page) => setPages((current) => ({ ...current, [tab]: page }))}
                />
              </>
            )}
          </QueryState>
        </TabsContent>
      </Tabs>

      <RescheduleDialog
        appointment={rescheduleTarget}
        onClose={() => setRescheduleTarget(undefined)}
      />
      <CancelDialog appointment={cancelTarget} onClose={() => setCancelTarget(undefined)} />
    </div>
  );
}

function RescheduleDialog({
  appointment,
  onClose,
}: {
  appointment: AppointmentDto | undefined;
  onClose: () => void;
}) {
  const reschedule = useRescheduleAppointment();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const range = useMemo(() => {
    const from = new Date();
    const to = new Date(from.getTime() + RESCHEDULE_HORIZON_DAYS * 24 * 60 * 60 * 1000);
    return { from: from.toISOString(), to: to.toISOString() };
  }, []);
  const slots = useDoctorSlots(appointment?.doctor.id, range.from, range.to);
  const dayGroups = useMemo(
    () => groupSlotsByLocalDate(slots.data ?? [], timezone),
    [slots.data, timezone],
  );

  async function pick(start: string) {
    if (!appointment) return;
    try {
      await reschedule.mutateAsync({ id: appointment.id, body: { startsAt: start } });
      toast.success('Appointment rescheduled');
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not reschedule the appointment');
    }
  }

  return (
    <Dialog open={appointment !== undefined} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reschedule with {appointment?.doctor.displayName}</DialogTitle>
          <DialogDescription>
            Choose a new time. The current appointment will be cancelled.
          </DialogDescription>
        </DialogHeader>
        <div className="flex max-h-80 flex-col gap-3 overflow-y-auto">
          {slots.isPending && <p className="text-muted-foreground">Loading…</p>}
          {slots.data && dayGroups.length === 0 && (
            <p className="text-muted-foreground">
              No other times are available in the next {RESCHEDULE_HORIZON_DAYS} days.
            </p>
          )}
          {dayGroups.map((group) => (
            <div key={group.dateKey}>
              <p className="mb-1 text-sm font-medium text-muted-foreground">{group.label}</p>
              <div className="flex flex-wrap gap-2">
                {group.slots.map((slot) => (
                  <Button
                    key={slot.start}
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={reschedule.isPending}
                    onClick={() => void pick(slot.start)}
                  >
                    {formatSlotTimeOnly(slot.start, timezone)}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CancelDialog({
  appointment,
  onClose,
}: {
  appointment: AppointmentDto | undefined;
  onClose: () => void;
}) {
  const cancelAppointment = useCancelAppointment();
  const [reason, setReason] = useState('');

  async function confirm() {
    if (!appointment) return;
    try {
      await cancelAppointment.mutateAsync({
        id: appointment.id,
        body: { reason: reason.trim() === '' ? undefined : reason.trim() },
      });
      toast.success('Appointment cancelled');
      setReason('');
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not cancel the appointment');
    }
  }

  return (
    <Dialog
      open={appointment !== undefined}
      onOpenChange={(open) => {
        if (!open) {
          setReason('');
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel this appointment?</DialogTitle>
          <DialogDescription>
            With {appointment?.doctor.displayName}. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1">
          <Label htmlFor="cancel-reason">Reason (optional)</Label>
          <Textarea
            id="cancel-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Keep appointment
          </Button>
          <Button
            type="button"
            disabled={cancelAppointment.isPending}
            onClick={() => void confirm()}
          >
            {cancelAppointment.isPending ? 'Cancelling…' : 'Cancel appointment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
