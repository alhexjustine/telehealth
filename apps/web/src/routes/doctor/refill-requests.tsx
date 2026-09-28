import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatSlotDateAndTime } from '@/lib/discovery/slot-grouping';
import { relationshipLabel } from '@/lib/dependents/relationship-label';
import {
  useApproveRefill,
  useDenyRefill,
  useDoctorRefillRequests,
  type RefillRequestDto,
} from '@/lib/refills/use-doctor-refills';
import { QueryState } from '@/components/query-state';

type Decision = 'approve' | 'deny';

export function DoctorRefillRequestsPage() {
  const requests = useDoctorRefillRequests('PENDING');
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const approveRefill = useApproveRefill();
  const denyRefill = useDenyRefill();
  const [deciding, setDeciding] = useState<{ request: RefillRequestDto; decision: Decision } | undefined>(undefined);
  const [note, setNote] = useState('');

  async function confirmDecision() {
    if (!deciding) return;
    const mutation = deciding.decision === 'approve' ? approveRefill : denyRefill;
    try {
      await mutation.mutateAsync({ id: deciding.request.id, doctorNote: note.trim() || undefined });
      toast.success(deciding.decision === 'approve' ? 'Refill approved' : 'Refill denied');
      setDeciding(undefined);
      setNote('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save this decision');
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <h1 className="text-2xl font-semibold">Refill requests</h1>
      <p className="text-sm text-muted-foreground">Pending prescription refill requests from your patients.</p>

      <QueryState
        query={requests}
        label="refill requests"
        isEmpty={(data) => data.items.length === 0}
        empty={<p className="text-muted-foreground">No pending refill requests.</p>}
      >
        {(data) => (
          <div className="flex flex-col gap-3">
            {data.items.map((request) => (
              <Card key={request.id}>
                <CardContent className="flex flex-col gap-2 pt-6">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">
                      {request.dependent
                        ? `${request.dependent.displayName} (${relationshipLabel(request.dependent.relationship)})`
                        : request.patient.displayName}
                    </p>
                    <Badge variant="secondary">{request.medication}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Consultation on {formatSlotDateAndTime(request.appointmentStartsAt, timezone)}
                  </p>
                  {request.patientNote && <p className="text-sm">{request.patientNote}</p>}
                  <div className="mt-1 flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setDeciding({ request, decision: 'deny' })}
                    >
                      Deny
                    </Button>
                    <Button type="button" size="sm" onClick={() => setDeciding({ request, decision: 'approve' })}>
                      Approve
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </QueryState>

      <DecideRefillDialog
        deciding={deciding}
        note={note}
        onNoteChange={setNote}
        onClose={() => {
          setDeciding(undefined);
          setNote('');
        }}
        onConfirm={() => void confirmDecision()}
        isPending={approveRefill.isPending || denyRefill.isPending}
      />
    </div>
  );
}

function DecideRefillDialog({
  deciding,
  note,
  onNoteChange,
  onClose,
  onConfirm,
  isPending,
}: {
  deciding: { request: RefillRequestDto; decision: Decision } | undefined;
  note: string;
  onNoteChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
}) {
  const isApprove = deciding?.decision === 'approve';

  return (
    <Dialog open={deciding !== undefined} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isApprove ? 'Approve' : 'Deny'} refill for {deciding?.request.medication}?
          </DialogTitle>
        </DialogHeader>
        <Textarea
          rows={3}
          placeholder="Optional note for the patient"
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={isPending} onClick={onConfirm}>
            {isPending ? 'Saving…' : isApprove ? 'Approve' : 'Deny'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
