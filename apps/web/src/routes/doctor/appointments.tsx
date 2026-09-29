import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
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
  useRebookAppointment,
  useRescheduleAppointment,
} from '@/lib/appointments/use-appointments';
import { formatSlotDateAndTime } from '@/lib/discovery/slot-grouping';
import { JoinConsultationButton } from '@/components/join-consultation-button';
import { QueryState } from '@/components/query-state';
import { Pagination } from '@/components/pagination';
import { SlotPickerDialog } from '@/components/slot-picker-dialog';
import { relationshipLabel } from '@/lib/dependents/relationship-label';

type AppointmentDto =
  ApiPaths['/appointments']['get']['responses'][200]['content']['application/json']['items'][number];

const PAGE_SIZE = 5;

const CANCEL_REASON_MIN_LENGTH = 5;
const RESCHEDULE_CUTOFF_MINUTES = 120;
const FOLLOW_UP_HORIZON_DAYS = 30;

function statusVariant(status: AppointmentDto['status']): 'default' | 'secondary' | 'outline' {
  if (status === 'BOOKED') return 'default';
  if (status === 'CANCELLED') return 'outline';
  return 'secondary';
}

export function DoctorAppointmentsPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [pages, setPages] = useState({ upcoming: 1, past: 1 });
  const upcoming = useAppointments('upcoming', pages.upcoming, PAGE_SIZE);
  const past = useAppointments('past', pages.past, PAGE_SIZE);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [cancelTarget, setCancelTarget] = useState<AppointmentDto | undefined>(undefined);
  const [rescheduleTarget, setRescheduleTarget] = useState<AppointmentDto | undefined>(undefined);
  const [rebookTarget, setRebookTarget] = useState<AppointmentDto | undefined>(undefined);
  const reschedule = useRescheduleAppointment();
  const rebook = useRebookAppointment();
  // Captured once per render (not read inside the .map() below) so the
  // "now" comparison stays a pure render computation.
  const now = useMemo(() => new Date().getTime(), []);

  const activeQuery = tab === 'upcoming' ? upcoming : past;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Appointments</h1>

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
              <p className="text-muted-foreground">
                {tab === 'upcoming'
                  ? "You don't have any upcoming appointments."
                  : "You don't have any past appointments."}
              </p>
            }
          >
            {(data) => (
              <>
                {data.items.map((appointment) => {
                  const canCancel =
                    appointment.status === 'BOOKED' &&
                    new Date(appointment.startsAt).getTime() > now;
                  const isUpcoming =
                    appointment.status === 'BOOKED' &&
                    new Date(appointment.startsAt).getTime() > now;
                  const canReschedule =
                    appointment.status === 'BOOKED' &&
                    (new Date(appointment.startsAt).getTime() - now) / 60_000 >=
                      RESCHEDULE_CUTOFF_MINUTES;
                  return (
                    <Card key={appointment.id} className="transition-shadow hover:shadow-md">
                      <CardContent
                        className="flex cursor-pointer flex-col gap-4 pt-6"
                        onClick={() => void navigate(`/doctor/appointments/${appointment.id}`)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-display text-lg font-semibold">
                              {formatSlotDateAndTime(appointment.startsAt, timezone)}
                            </span>
                            <p className="font-medium">
                              {appointment.dependent
                                ? `${appointment.dependent.displayName} (${relationshipLabel(appointment.dependent.relationship)})`
                                : `${appointment.patient.displayName}${appointment.patient.age !== null ? `, ${appointment.patient.age}` : ''}`}
                            </p>
                            {appointment.dependent && (
                              <p className="text-xs text-muted-foreground">
                                Booked by {appointment.patient.displayName}
                              </p>
                            )}
                          </div>
                          <Badge variant={statusVariant(appointment.status)}>
                            {appointment.status}
                          </Badge>
                        </div>

                        <div className="flex flex-col gap-2">
                          <p className="text-sm text-muted-foreground">{appointment.reason}</p>
                          {appointment.symptoms.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {appointment.symptoms.map((symptom) => (
                                <Badge key={symptom.id} variant="secondary">
                                  {symptom.name}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>

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
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setRebookTarget(appointment)}
                              >
                                Book again
                              </Button>
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

      <DoctorCancelDialog appointment={cancelTarget} onClose={() => setCancelTarget(undefined)} />

      <SlotPickerDialog
        open={rescheduleTarget !== undefined}
        doctorId={rescheduleTarget?.doctor.id}
        title={`Reschedule with ${rescheduleTarget?.patient.displayName ?? ''}`}
        description="Choose a new time. The current appointment will be cancelled and the patient notified."
        pending={reschedule.isPending}
        onClose={() => setRescheduleTarget(undefined)}
        onPick={(start) =>
          void (async () => {
            if (!rescheduleTarget) return;
            try {
              await reschedule.mutateAsync({ id: rescheduleTarget.id, body: { startsAt: start } });
              toast.success('Appointment rescheduled');
              setRescheduleTarget(undefined);
            } catch (error) {
              toast.error(
                error instanceof Error ? error.message : 'Could not reschedule the appointment',
              );
            }
          })()
        }
      />

      <SlotPickerDialog
        open={rebookTarget !== undefined}
        doctorId={rebookTarget?.doctor.id}
        title={`Book a follow-up with ${rebookTarget?.patient.displayName ?? ''}`}
        description="Choose a time for a new appointment. The patient will be notified."
        horizonDays={FOLLOW_UP_HORIZON_DAYS}
        pending={rebook.isPending}
        onClose={() => setRebookTarget(undefined)}
        onPick={(start) =>
          void (async () => {
            if (!rebookTarget) return;
            try {
              await rebook.mutateAsync({ id: rebookTarget.id, body: { startsAt: start } });
              toast.success('Follow-up booked');
              setRebookTarget(undefined);
            } catch (error) {
              toast.error(error instanceof Error ? error.message : 'Could not book the follow-up');
            }
          })()
        }
      />
    </div>
  );
}

function DoctorCancelDialog({
  appointment,
  onClose,
}: {
  appointment: AppointmentDto | undefined;
  onClose: () => void;
}) {
  const cancelAppointment = useCancelAppointment();
  const [reason, setReason] = useState('');

  const reasonValid = reason.trim().length >= CANCEL_REASON_MIN_LENGTH;

  async function confirm() {
    if (!appointment || !reasonValid) return;
    try {
      await cancelAppointment.mutateAsync({ id: appointment.id, body: { reason: reason.trim() } });
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
            With {appointment?.patient.displayName}. A reason is required and will be shown to the
            patient.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1">
          <Label htmlFor="doctor-cancel-reason">Reason</Label>
          <Textarea
            id="doctor-cancel-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
          />
          {!reasonValid && reason.length > 0 && (
            <p className="text-sm text-destructive">
              At least {CANCEL_REASON_MIN_LENGTH} characters are required.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Keep appointment
          </Button>
          <Button
            type="button"
            disabled={cancelAppointment.isPending || !reasonValid}
            onClick={() => void confirm()}
          >
            {cancelAppointment.isPending ? 'Cancelling…' : 'Cancel appointment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
