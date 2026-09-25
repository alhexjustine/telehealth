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
import { useAppointments, useCancelAppointment } from '@/lib/appointments/use-appointments';
import { formatSlotDateAndTime } from '@/lib/discovery/slot-grouping';

type AppointmentDto =
  ApiPaths['/appointments']['get']['responses'][200]['content']['application/json']['items'][number];

const CANCEL_REASON_MIN_LENGTH = 5;

function statusVariant(status: AppointmentDto['status']): 'default' | 'secondary' | 'outline' {
  if (status === 'BOOKED') return 'default';
  if (status === 'CANCELLED') return 'outline';
  return 'secondary';
}

export function DoctorAppointmentsPage() {
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const upcoming = useAppointments('upcoming');
  const past = useAppointments('past', 1, 20);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [cancelTarget, setCancelTarget] = useState<AppointmentDto | undefined>(undefined);
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
          {activeQuery.isPending && <p className="text-muted-foreground">Loading…</p>}
          {activeQuery.data && activeQuery.data.items.length === 0 && (
            <p className="text-muted-foreground">No {tab} appointments.</p>
          )}
          {activeQuery.data?.items.map((appointment) => {
            const canCancel = appointment.status === 'BOOKED' && new Date(appointment.startsAt).getTime() > now;
            return (
              <Card key={appointment.id}>
                <CardContent className="flex flex-col gap-2 pt-6 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <Link to={`/doctor/appointments/${appointment.id}`} className="font-medium hover:underline">
                      {formatSlotDateAndTime(appointment.startsAt, timezone)}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {appointment.patient.displayName}
                      {appointment.patient.age !== null ? `, ${appointment.patient.age}` : ''}
                    </p>
                    <p className="text-sm text-muted-foreground">{appointment.reason}</p>
                    {appointment.symptoms.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {appointment.symptoms.map((symptom) => (
                          <Badge key={symptom.id} variant="secondary">
                            {symptom.name}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-start gap-2 sm:items-end">
                    <Badge variant={statusVariant(appointment.status)}>{appointment.status}</Badge>
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
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>
      </Tabs>

      <DoctorCancelDialog appointment={cancelTarget} onClose={() => setCancelTarget(undefined)} />
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
            With {appointment?.patient.displayName}. A reason is required and will be shown to the patient.
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
          <Button type="button" disabled={cancelAppointment.isPending || !reasonValid} onClick={() => void confirm()}>
            {cancelAppointment.isPending ? 'Cancelling…' : 'Cancel appointment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
