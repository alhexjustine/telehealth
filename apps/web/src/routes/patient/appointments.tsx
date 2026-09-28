import { useMemo, useState } from 'react';
import { Link } from 'react-router';
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
import { useAppointments, useCancelAppointment, useRescheduleAppointment } from '@/lib/appointments/use-appointments';
import { useDoctorSlots } from '@/lib/availability/use-availability';
import { formatSlotDateAndTime, formatSlotTimeOnly, groupSlotsByLocalDate } from '@/lib/discovery/slot-grouping';
import { JoinConsultationButton } from '@/components/join-consultation-button';
import { QueryState } from '@/components/query-state';
import { buttonVariants } from '@/components/ui/button';

type AppointmentDto =
  ApiPaths['/appointments']['get']['responses'][200]['content']['application/json']['items'][number];

const RESCHEDULE_HORIZON_DAYS = 14;
const RESCHEDULE_CUTOFF_MINUTES = 120;

function statusVariant(status: AppointmentDto['status']): 'default' | 'secondary' | 'outline' {
  if (status === 'BOOKED') return 'default';
  if (status === 'CANCELLED') return 'outline';
  return 'secondary';
}

export function PatientAppointmentsPage() {
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const upcoming = useAppointments('upcoming');
  const past = useAppointments('past', 1, 20);
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
            {(data) =>
              data.items.map((appointment) => {
                const minutesUntilStart = (new Date(appointment.startsAt).getTime() - now) / 60_000;
                const canReschedule =
                  appointment.status === 'BOOKED' && minutesUntilStart >= RESCHEDULE_CUTOFF_MINUTES;
                const canCancel = appointment.status === 'BOOKED' && minutesUntilStart > 0;

                return (
                  <Card key={appointment.id}>
                    <CardContent className="flex flex-col gap-2 pt-6 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <Link
                          to={`/patient/appointments/${appointment.id}`}
                          className="font-medium hover:underline"
                        >
                          {formatSlotDateAndTime(appointment.startsAt, timezone)}
                        </Link>
                        <p className="text-sm text-muted-foreground">{appointment.doctor.displayName}</p>
                        <p className="text-sm text-muted-foreground">{appointment.reason}</p>
                      </div>
                      <div className="flex flex-col items-start gap-2 sm:items-end">
                        <Badge variant={statusVariant(appointment.status)}>{appointment.status}</Badge>
                        <JoinConsultationButton
                          appointmentId={appointment.id}
                          status={appointment.status}
                          startsAt={appointment.startsAt}
                          endsAt={appointment.endsAt}
                        />
                        <div className="flex gap-2">
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
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={!canCancel}
                            title={canCancel ? undefined : 'This appointment can no longer be cancelled'}
                            onClick={() => setCancelTarget(appointment)}
                          >
                            Cancel
                          </Button>
                          <Link
                            to={`/patient/doctors/${appointment.doctor.id}?dependent=${appointment.dependent?.id ?? ''}`}
                            className={buttonVariants({ variant: 'outline', size: 'sm' })}
                          >
                            Book again
                          </Link>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            }
          </QueryState>
        </TabsContent>
      </Tabs>

      <RescheduleDialog appointment={rescheduleTarget} onClose={() => setRescheduleTarget(undefined)} />
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
  const dayGroups = useMemo(() => groupSlotsByLocalDate(slots.data ?? [], timezone), [slots.data, timezone]);

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
          <DialogDescription>Choose a new time. The current appointment will be cancelled.</DialogDescription>
        </DialogHeader>
        <div className="flex max-h-80 flex-col gap-3 overflow-y-auto">
          {slots.isPending && <p className="text-muted-foreground">Loading…</p>}
          {slots.data && dayGroups.length === 0 && (
            <p className="text-muted-foreground">No other times are available in the next {RESCHEDULE_HORIZON_DAYS} days.</p>
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

function CancelDialog({ appointment, onClose }: { appointment: AppointmentDto | undefined; onClose: () => void }) {
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
          <DialogDescription>With {appointment?.doctor.displayName}. This cannot be undone.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1">
          <Label htmlFor="cancel-reason">Reason (optional)</Label>
          <Textarea id="cancel-reason" value={reason} onChange={(event) => setReason(event.target.value)} rows={3} />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Keep appointment
          </Button>
          <Button type="button" disabled={cancelAppointment.isPending} onClick={() => void confirm()}>
            {cancelAppointment.isPending ? 'Cancelling…' : 'Cancel appointment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
