import { useState } from 'react';
import { Link } from 'react-router';
import { CheckCircle2, Pill, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { EmptyState } from '@/components/empty-state';

type Decision = 'approve' | 'deny';

const TABS = [
  {
    status: 'PENDING',
    label: 'Pending',
    icon: Pill,
    emptyTitle: 'No pending requests',
    emptyDescription: 'New refill requests from your patients will show up here, ready for you to review.',
  },
  {
    status: 'APPROVED',
    label: 'Approved',
    icon: CheckCircle2,
    emptyTitle: 'No approved requests yet',
    emptyDescription: 'Requests you approve will move here, along with any note you leave for the patient.',
  },
  {
    status: 'DENIED',
    label: 'Denied',
    icon: XCircle,
    emptyTitle: 'No denied requests',
    emptyDescription: 'Requests you deny will land here, so you can look back on the reason you gave.',
  },
] as const;

export function DoctorRefillRequestsPage() {
  const [status, setStatus] = useState<(typeof TABS)[number]['status']>('PENDING');
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
      <p className="text-sm text-muted-foreground">Prescription refill requests from your patients.</p>

      <Tabs value={status} onValueChange={(value) => setStatus(value as (typeof TABS)[number]['status'])}>
        <TabsList>
          {TABS.map((tab) => (
            <TabsTrigger key={tab.status} value={tab.status}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {TABS.map((tab) => (
          <TabsContent key={tab.status} value={tab.status}>
            <RefillRequestList
              status={tab.status}
              emptyIcon={tab.icon}
              emptyTitle={tab.emptyTitle}
              emptyDescription={tab.emptyDescription}
              onDecide={(request, decision) => setDeciding({ request, decision })}
            />
          </TabsContent>
        ))}
      </Tabs>

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

function RefillRequestList({
  status,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  onDecide,
}: {
  status: (typeof TABS)[number]['status'];
  emptyIcon: (typeof TABS)[number]['icon'];
  emptyTitle: string;
  emptyDescription: string;
  onDecide: (request: RefillRequestDto, decision: Decision) => void;
}) {
  const requests = useDoctorRefillRequests(status);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <QueryState
      query={requests}
      label="refill requests"
      isEmpty={(data) => data.items.length === 0}
      empty={<EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} />}
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
                <Link
                  to={
                    request.dependent
                      ? `/doctor/patients/${request.patient.id}?dependentId=${request.dependent.id}`
                      : `/doctor/patients/${request.patient.id}`
                  }
                  className="text-sm text-primary underline-offset-4 hover:underline"
                >
                  View patient record
                </Link>
                {request.patientNote && <p className="text-sm">{request.patientNote}</p>}
                {request.status === 'PENDING' ? (
                  <div className="mt-1 flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => onDecide(request, 'deny')}>
                      Deny
                    </Button>
                    <Button type="button" size="sm" onClick={() => onDecide(request, 'approve')}>
                      Approve
                    </Button>
                  </div>
                ) : (
                  <div className="mt-1 flex flex-col gap-1 text-sm text-muted-foreground">
                    <span>
                      {request.status === 'APPROVED' ? 'Approved' : 'Denied'}
                      {request.decidedAt ? ` on ${formatSlotDateAndTime(request.decidedAt, timezone)}` : null}
                    </span>
                    {request.doctorNote && <span>{request.doctorNote}</span>}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </QueryState>
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
