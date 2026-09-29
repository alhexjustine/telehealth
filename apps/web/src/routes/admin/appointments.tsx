import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AdminAuditLink } from '@/components/admin/audit-link';
import { formatSlotDateTime } from '@/lib/format-slot-time';
import {
  useAdminAppointments,
  useAdminCancelAppointment,
  useMarkNotHeld,
  type AdminAppointmentListQuery,
} from '@/lib/admin/use-admin-appointments';
import { QueryState } from '@/components/query-state';
import { Pagination } from '@/components/pagination';
import { relationshipLabel } from '@/lib/dependents/relationship-label';

type AdminAppointmentItem = NonNullable<ReturnType<typeof useAdminAppointments>['data']>['items'][number];
type DialogAction = 'cancel' | 'mark-not-held';

const PAGE_SIZE = 5;
const REASON_MIN_LENGTH = 5;
const selectClassName =
  'h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

function statusVariant(status: string): 'default' | 'secondary' | 'outline' | 'destructive' {
  if (status === 'BOOKED') return 'default';
  if (status === 'CANCELLED') return 'outline';
  if (status === 'NOT_HELD') return 'destructive';
  return 'secondary';
}

export function AdminAppointmentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [dialog, setDialog] = useState<{ appointment: AdminAppointmentItem; action: DialogAction } | undefined>(undefined);

  const invalidOnly = searchParams.get('invalidOnly') === 'true';
  const query: AdminAppointmentListQuery = {
    status: (searchParams.get('status') as AdminAppointmentListQuery['status']) || undefined,
    invalidOnly: invalidOnly || undefined,
    page: Number(searchParams.get('page') ?? '1') || 1,
    pageSize: PAGE_SIZE,
  };
  const appointments = useAdminAppointments(query);
  // Captured once per render, not read inside the .map() below, so the "now"
  // comparison stays a pure render computation (see DoctorAppointmentsPage).
  const now = useMemo(() => new Date().getTime(), []);

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page');
    setSearchParams(next);
  }

  function goToPage(page: number) {
    const next = new URLSearchParams(searchParams);
    if (page > 1) next.set('page', String(page));
    else next.delete('page');
    setSearchParams(next);
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Appointments</h1>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 pt-6">
          <div className="flex flex-col gap-1">
            <Label htmlFor="admin-appointments-status">Status</Label>
            <select
              id="admin-appointments-status"
              className={selectClassName}
              value={searchParams.get('status') ?? ''}
              onChange={(e) => updateParam('status', e.target.value)}
            >
              <option value="">All statuses</option>
              <option value="BOOKED">Booked</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="COMPLETED">Completed</option>
              <option value="NOT_HELD">Not held</option>
            </select>
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <Checkbox
              checked={invalidOnly}
              onCheckedChange={(checked) => updateParam('invalidOnly', checked ? 'true' : '')}
            />
            Invalid only
          </label>
        </CardContent>
      </Card>

      <QueryState
        query={appointments}
        label="appointments"
        isEmpty={(data) => data.items.length === 0}
        empty={<p className="text-muted-foreground">No appointments match your filters.</p>}
      >
        {(data) => (
          <div className="flex flex-col gap-3">
            {data.items.map((appointment) => {
              const canCancel = appointment.status === 'BOOKED' && new Date(appointment.endsAt).getTime() > now;
              const canMarkNotHeld = appointment.flags.includes('NOT_COMPLETED');
              return (
                <Card key={appointment.id}>
                  <CardContent className="flex flex-col gap-2 pt-6 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium">{formatSlotDateTime(appointment.startsAt)}</p>
                      <p className="text-sm text-muted-foreground">
                        {appointment.patient.displayName} with Dr. {appointment.doctor.displayName}
                      </p>
                      {appointment.dependent && (
                        <p className="text-sm text-muted-foreground">
                          For {appointment.dependent.displayName} ({relationshipLabel(appointment.dependent.relationship)})
                        </p>
                      )}
                      <div className="mt-1 flex flex-wrap gap-1">
                        <Badge variant={statusVariant(appointment.status)}>{appointment.status}</Badge>
                        <Badge variant="outline">{appointment.consultationState}</Badge>
                        {appointment.flags.map((flag) => (
                          <Badge key={flag} variant="destructive">
                            {flag}
                          </Badge>
                        ))}
                      </div>
                      {appointment.messageCount > 0 && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {appointment.messageCount} message{appointment.messageCount === 1 ? '' : 's'}
                          {appointment.lastMessageAt &&
                            ` · last ${formatDistanceToNow(new Date(appointment.lastMessageAt), { addSuffix: true })}`}
                        </p>
                      )}
                      <AdminAuditLink entityType="Appointment" entityId={appointment.id} />
                    </div>
                    <div className="flex gap-2">
                      {canCancel && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setDialog({ appointment, action: 'cancel' })}
                        >
                          Cancel
                        </Button>
                      )}
                      {canMarkNotHeld && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setDialog({ appointment, action: 'mark-not-held' })}
                        >
                          Mark not held
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={goToPage} />
          </div>
        )}
      </QueryState>

      <AppointmentActionDialog target={dialog} onClose={() => setDialog(undefined)} />
    </div>
  );
}

function AppointmentActionDialog({
  target,
  onClose,
}: {
  target: { appointment: AdminAppointmentItem; action: DialogAction } | undefined;
  onClose: () => void;
}) {
  const cancelAppointment = useAdminCancelAppointment();
  const markNotHeld = useMarkNotHeld();
  const [reason, setReason] = useState('');
  const reasonValid = reason.trim().length >= REASON_MIN_LENGTH;
  const pending = cancelAppointment.isPending || markNotHeld.isPending;

  async function confirm() {
    if (!target || !reasonValid) return;
    try {
      if (target.action === 'cancel') {
        await cancelAppointment.mutateAsync({ id: target.appointment.id, body: { reason: reason.trim() } });
        toast.success('Appointment cancelled');
      } else {
        await markNotHeld.mutateAsync({ id: target.appointment.id, body: { reason: reason.trim() } });
        toast.success('Appointment marked not held');
      }
      setReason('');
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not complete the action');
    }
  }

  const title = target?.action === 'cancel' ? 'Cancel this appointment?' : 'Mark this appointment not held?';

  return (
    <Dialog
      open={target !== undefined}
      onOpenChange={(open) => {
        if (!open) {
          setReason('');
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-1">
          <Label htmlFor="admin-appointment-action-reason">Reason</Label>
          <Textarea
            id="admin-appointment-action-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          {!reasonValid && reason.length > 0 && (
            <p className="text-sm text-destructive">At least {REASON_MIN_LENGTH} characters are required.</p>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Keep appointment
          </Button>
          <Button type="button" disabled={!reasonValid || pending} onClick={() => void confirm()}>
            {pending ? 'Saving…' : 'Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
