import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { toast } from 'sonner';
import { ArrowLeft, Circle } from 'lucide-react';
import type { ApiPaths } from 'api-client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RealtimeProvider } from '@/lib/realtime/realtime-provider';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import { isJoinable, joinWindowOpensAt } from '@/lib/consultations/consultation-window';
import {
  useAddPrescription,
  useCompleteConsultation,
  useConsultationWorkspace,
  useDeletePrescription,
  useJoinConsultation,
  useSaveConsultationNote,
  useStartConsultation,
  useUpdatePrescription,
} from '@/lib/consultations/use-consultation';
import { useConsultationPresence } from '@/lib/consultations/use-consultation-socket';
import { formatSlotDateAndTime } from '@/lib/discovery/slot-grouping';
import { QueryState } from '@/components/query-state';
import { relationshipLabel } from '@/lib/dependents/relationship-label';

type WorkspaceDto =
  ApiPaths['/consultations/{appointmentId}']['get']['responses'][200]['content']['application/json'];
type PrescriptionDto = NonNullable<WorkspaceDto['prescriptions']>[number];

const SESSION_STATES = ['SCHEDULED', 'JOINED', 'IN_PROGRESS', 'COMPLETED'] as const;

export function ConsultationWorkspacePage() {
  return (
    <RealtimeProvider>
      <ConsultationWorkspaceContent />
    </RealtimeProvider>
  );
}

function ConsultationWorkspaceContent() {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const { data: user } = useCurrentUser();
  const workspace = useConsultationWorkspace(appointmentId);
  const presence = useConsultationPresence(appointmentId);
  const join = useJoinConsultation(appointmentId ?? '');
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const hasAutoJoined = useRef(false);

  const data = workspace.data;
  const joinable = data ? isJoinable({ status: 'BOOKED', startsAt: data.startsAt, endsAt: data.endsAt }) : false;
  const alreadyJoined = user?.role === 'DOCTOR' ? data?.session.doctorJoinedAt !== null : data?.session.patientJoinedAt !== null;

  // Auto-join once, on mount, while inside the window (idempotent
  // server-side — see the "Joining" requirement) — skipped when the cached
  // workspace already shows this viewer as joined, so remounting the page
  // (or a live state push) doesn't make a redundant call.
  useEffect(() => {
    if (!data || hasAutoJoined.current || !joinable || alreadyJoined) return;
    hasAutoJoined.current = true;
    join.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.appointmentId, joinable, alreadyJoined]);

  if (!appointmentId) {
    return <p className="text-muted-foreground">Consultation not found.</p>;
  }

  const isDoctor = user?.role === 'DOCTOR';
  const backTo = isDoctor ? `/doctor/appointments/${appointmentId}` : `/patient/appointments/${appointmentId}`;

  return (
    <QueryState
      query={workspace}
      label="the consultation workspace"
      loading={<p className="p-6 text-muted-foreground">Loading…</p>}
    >
      {(workspaceData) => (
        <div className="flex min-h-screen flex-col">
          <header className="flex items-center gap-3 border-b border-border px-6 py-3">
            <Link to={backTo} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="size-4" /> Back
            </Link>
            <span className="font-semibold">Consultation workspace</span>
            <Badge variant="outline" className="ml-auto">
              {workspaceData.session.state.replace('_', ' ')}
            </Badge>
          </header>

          <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-6 lg:flex-row">
            <div className="flex flex-1 flex-col gap-4">
              <AppointmentContextCard data={workspaceData} timezone={timezone} />
              <StateTimeline session={workspaceData.session} timezone={timezone} />
              <PresenceCard presence={presence} />
              {!joinable && workspaceData.session.state === 'SCHEDULED' && (
                <CountdownCard startsAt={workspaceData.startsAt} />
              )}
            </div>

            <div className="flex flex-1 flex-col gap-4">
              {isDoctor ? (
                <DoctorPanel
                  appointmentId={appointmentId}
                  data={workspaceData}
                  patientJoined={presence.patientPresent || workspaceData.session.patientJoinedAt !== null}
                />
              ) : (
                <PatientPanel data={workspaceData} timezone={timezone} />
              )}
            </div>
          </main>
        </div>
      )}
    </QueryState>
  );
}

function AppointmentContextCard({ data, timezone }: { data: WorkspaceDto; timezone: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{formatSlotDateAndTime(data.startsAt, timezone)}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <p className="text-sm">
          {data.patient.displayName} with {data.doctor.displayName}
          {data.dependent && (
            <Badge variant="outline" className="ml-2">
              {relationshipLabel(data.dependent.relationship)}
            </Badge>
          )}
        </p>
        <p className="text-sm text-muted-foreground">{data.reason}</p>
        {data.symptoms.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {data.symptoms.map((symptom) => (
              <Badge key={symptom.id} variant="secondary">
                {symptom.name}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StateTimeline({ session, timezone }: { session: WorkspaceDto['session']; timezone: string }) {
  const timeFor = (state: (typeof SESSION_STATES)[number]): string | null => {
    if (state === 'SCHEDULED') return null;
    if (state === 'JOINED') return session.patientJoinedAt ?? session.doctorJoinedAt;
    if (state === 'IN_PROGRESS') return session.startedAt;
    return session.completedAt;
  };
  const currentIndex = SESSION_STATES.indexOf(session.state);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Session timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="flex flex-col gap-2">
          {SESSION_STATES.map((state, index) => {
            const reached = index <= currentIndex;
            const time = timeFor(state);
            return (
              <li key={state} className="flex items-center gap-2 text-sm">
                <Circle className={`size-2 ${reached ? 'fill-primary text-primary' : 'text-muted-foreground'}`} />
                <span className={reached ? 'font-medium' : 'text-muted-foreground'}>{state.replace('_', ' ')}</span>
                {time && (
                  <span className="text-muted-foreground">
                    · {new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', timeZone: timezone }).format(new Date(time))}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}

function PresenceCard({ presence }: { presence: { patientPresent: boolean; doctorPresent: boolean } }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-6 pt-6 text-sm">
        <span className="flex items-center gap-2">
          <Circle className={`size-2 ${presence.patientPresent ? 'fill-green-500 text-green-500' : 'text-muted-foreground'}`} />
          Patient {presence.patientPresent ? 'present' : 'not present'}
        </span>
        <span className="flex items-center gap-2">
          <Circle className={`size-2 ${presence.doctorPresent ? 'fill-green-500 text-green-500' : 'text-muted-foreground'}`} />
          Doctor {presence.doctorPresent ? 'present' : 'not present'}
        </span>
      </CardContent>
    </Card>
  );
}

function CountdownCard({ startsAt }: { startsAt: string }) {
  const opensAt = useMemo(() => joinWindowOpensAt(startsAt), [startsAt]);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const remainingMs = opensAt.getTime() - now.getTime();
  if (remainingMs <= 0) return null;

  const minutes = Math.floor(remainingMs / 60_000);
  const seconds = Math.floor((remainingMs % 60_000) / 1000);

  return (
    <Card data-testid="join-countdown">
      <CardContent className="pt-6 text-sm text-muted-foreground">
        Joining opens in {minutes}:{String(seconds).padStart(2, '0')}
      </CardContent>
    </Card>
  );
}

function PatientPanel({ data, timezone }: { data: WorkspaceDto; timezone: string }) {
  if (data.session.state === 'COMPLETED') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Consultation summary</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm whitespace-pre-wrap">{data.note?.patientSummary ?? 'No summary was recorded.'}</p>
          {(data.prescriptions ?? []).length > 0 && (
            <div>
              <p className="mb-1 text-sm font-medium">Prescriptions</p>
              <PrescriptionsReadOnlyList prescriptions={data.prescriptions ?? []} />
            </div>
          )}
          <Link to={`/patient/records/${data.appointmentId}`} className="text-sm text-primary underline-offset-4 hover:underline">
            View the full record
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6 text-sm text-muted-foreground">
        {data.session.state === 'IN_PROGRESS' ? 'The consultation is in progress.' : 'Waiting for the doctor…'}
      </CardContent>
      <CardContent className="pt-0 text-xs text-muted-foreground">{formatSlotDateAndTime(data.startsAt, timezone)}</CardContent>
    </Card>
  );
}

function PrescriptionsReadOnlyList({ prescriptions }: { prescriptions: PrescriptionDto[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {prescriptions.map((prescription) => (
        <li key={prescription.id} className="rounded-md border border-input p-2 text-sm">
          <p className="font-medium">
            {prescription.medication} — {prescription.dosage}
          </p>
          <p className="text-muted-foreground">
            {prescription.frequency}, {prescription.duration}
          </p>
          {prescription.instructions && <p className="text-muted-foreground">{prescription.instructions}</p>}
        </li>
      ))}
    </ul>
  );
}

function DoctorPanel({
  appointmentId,
  data,
  patientJoined,
}: {
  appointmentId: string;
  data: WorkspaceDto;
  patientJoined: boolean;
}) {
  const start = useStartConsultation(appointmentId);
  const complete = useCompleteConsultation(appointmentId);
  const [confirmComplete, setConfirmComplete] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState(data.note?.patientSummary ?? '');

  const canStart = data.session.state === 'JOINED' && patientJoined;
  const canComplete = data.session.state === 'IN_PROGRESS' && summaryDraft.trim().length > 0;
  const editable = data.session.state === 'JOINED' || data.session.state === 'IN_PROGRESS';

  async function handleStart() {
    try {
      await start.mutateAsync();
      toast.success('Consultation started');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not start the consultation');
    }
  }

  async function handleComplete() {
    try {
      await complete.mutateAsync();
      toast.success('Consultation completed');
      setConfirmComplete(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not complete the consultation');
    }
  }

  return (
    <>
      {data.patientMedicalSummary && <PatientSummaryCard summary={data.patientMedicalSummary} />}

      <NoteEditor
        appointmentId={appointmentId}
        note={data.note ?? null}
        editable={editable}
        onSummaryChange={setSummaryDraft}
      />

      <PrescriptionsPanel appointmentId={appointmentId} prescriptions={data.prescriptions ?? []} editable={editable} />

      <Card>
        <CardContent className="flex flex-col gap-2 pt-6">
          <Button
            type="button"
            disabled={!canStart || start.isPending}
            title={canStart ? undefined : 'The patient must join before the consultation can start'}
            onClick={() => void handleStart()}
          >
            {start.isPending ? 'Starting…' : 'Start consultation'}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!canComplete}
            title={canComplete ? undefined : 'Write a patient summary before completing'}
            onClick={() => setConfirmComplete(true)}
          >
            Complete consultation
          </Button>
        </CardContent>
      </Card>

      <Dialog open={confirmComplete} onOpenChange={setConfirmComplete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete this consultation?</DialogTitle>
            <DialogDescription>
              The patient will be notified and can view the summary and prescriptions. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmComplete(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={complete.isPending} onClick={() => void handleComplete()}>
              {complete.isPending ? 'Completing…' : 'Complete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PatientSummaryCard({ summary }: { summary: NonNullable<WorkspaceDto['patientMedicalSummary']> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Patient summary</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1 text-sm">
        <p>Age: {summary.age ?? 'Unknown'}</p>
        <p>Conditions: {summary.medicalConditions ?? 'None recorded'}</p>
        <p>Allergies: {summary.allergies ?? 'None recorded'}</p>
        <p>Medications: {summary.currentMedications ?? 'None recorded'}</p>
      </CardContent>
    </Card>
  );
}

const AUTOSAVE_DEBOUNCE_MS = 1000;

function NoteEditor({
  appointmentId,
  note,
  editable,
  onSummaryChange,
}: {
  appointmentId: string;
  note: WorkspaceDto['note'] | null;
  editable: boolean;
  onSummaryChange: (value: string) => void;
}) {
  const saveNote = useSaveConsultationNote(appointmentId);
  const [findings, setFindings] = useState(note?.findings ?? '');
  const [assessment, setAssessment] = useState(note?.assessment ?? '');
  const [plan, setPlan] = useState(note?.plan ?? '');
  const [patientSummary, setPatientSummary] = useState(note?.patientSummary ?? '');
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const skipNextSave = useRef(true);

  useEffect(() => {
    onSummaryChange(patientSummary);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientSummary]);

  useEffect(() => {
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    if (!editable) return;
    const timer = setTimeout(() => {
      saveNote
        .mutateAsync({ findings, assessment, plan, patientSummary })
        .then(() => setSavedAt(new Date()))
        .catch(() => toast.error('Could not save the note'));
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [findings, assessment, plan, patientSummary, editable]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Consultation notes</CardTitle>
        <span className="text-xs text-muted-foreground">
          {saveNote.isPending ? 'Saving…' : savedAt ? 'Saved · just now' : ''}
        </span>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="note-findings">Findings</Label>
          <Textarea id="note-findings" rows={2} disabled={!editable} value={findings} onChange={(e) => setFindings(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="note-assessment">Assessment</Label>
          <Textarea id="note-assessment" rows={2} disabled={!editable} value={assessment} onChange={(e) => setAssessment(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="note-plan">Plan</Label>
          <Textarea id="note-plan" rows={2} disabled={!editable} value={plan} onChange={(e) => setPlan(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="note-summary">Patient summary</Label>
          <Textarea
            id="note-summary"
            rows={3}
            disabled={!editable}
            value={patientSummary}
            onChange={(e) => setPatientSummary(e.target.value)}
            placeholder="Required before completing the consultation"
          />
        </div>
      </CardContent>
    </Card>
  );
}

function PrescriptionsPanel({
  appointmentId,
  prescriptions,
  editable,
}: {
  appointmentId: string;
  prescriptions: PrescriptionDto[];
  editable: boolean;
}) {
  const addPrescription = useAddPrescription(appointmentId);
  const updatePrescription = useUpdatePrescription(appointmentId);
  const deletePrescription = useDeletePrescription(appointmentId);
  const [editing, setEditing] = useState<PrescriptionDto | 'new' | undefined>(undefined);

  async function remove(id: string) {
    try {
      await deletePrescription.mutateAsync(id);
      toast.success('Prescription removed');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not remove the prescription');
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Prescriptions</CardTitle>
        {editable && (
          <Button type="button" size="sm" variant="outline" onClick={() => setEditing('new')}>
            Add
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {prescriptions.length === 0 && <p className="text-sm text-muted-foreground">No prescriptions yet.</p>}
        <table className="w-full text-sm">
          <tbody>
            {prescriptions.map((prescription) => (
              <tr key={prescription.id} className="border-b border-border last:border-0">
                <td className="py-2 pr-2">
                  <p className="font-medium">{prescription.medication}</p>
                  <p className="text-muted-foreground">
                    {prescription.dosage} · {prescription.frequency} · {prescription.duration}
                  </p>
                  {prescription.instructions && <p className="text-muted-foreground">{prescription.instructions}</p>}
                </td>
                {editable && (
                  <td className="py-2 text-right align-top">
                    <Button type="button" size="sm" variant="outline" onClick={() => setEditing(prescription)}>
                      Edit
                    </Button>{' '}
                    <Button type="button" size="sm" variant="outline" onClick={() => void remove(prescription.id)}>
                      Remove
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>

      <PrescriptionDialog
        key={editing === undefined ? 'closed' : editing === 'new' ? 'new' : editing.id}
        target={editing}
        onClose={() => setEditing(undefined)}
        onCreate={(body) => addPrescription.mutateAsync(body)}
        onUpdate={(id, body) => updatePrescription.mutateAsync({ prescriptionId: id, body })}
      />
    </Card>
  );
}

interface PrescriptionFormValues {
  medication: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

const BLANK_PRESCRIPTION_FORM: PrescriptionFormValues = {
  medication: '',
  dosage: '',
  frequency: '',
  duration: '',
  instructions: '',
};

function initialPrescriptionFormValues(target: PrescriptionDto | 'new' | undefined): PrescriptionFormValues {
  if (target === undefined || target === 'new') return BLANK_PRESCRIPTION_FORM;
  return {
    medication: target.medication,
    dosage: target.dosage,
    frequency: target.frequency,
    duration: target.duration,
    instructions: target.instructions ?? '',
  };
}

/**
 * Rendered with `key={dialogKey(target)}` by its caller, so opening a
 * different prescription (or "new") remounts this component with a fresh
 * initial state instead of resetting form fields from an effect.
 */
function PrescriptionDialog({
  target,
  onClose,
  onCreate,
  onUpdate,
}: {
  target: PrescriptionDto | 'new' | undefined;
  onClose: () => void;
  onCreate: (body: PrescriptionFormValues) => Promise<unknown>;
  onUpdate: (id: string, body: Partial<PrescriptionFormValues>) => Promise<unknown>;
}) {
  const isEditing = target !== undefined && target !== 'new';
  const [values, setValues] = useState<PrescriptionFormValues>(() => initialPrescriptionFormValues(target));
  const [submitting, setSubmitting] = useState(false);

  const valid = values.medication.trim() && values.dosage.trim() && values.frequency.trim() && values.duration.trim();

  async function submit() {
    if (!valid) return;
    setSubmitting(true);
    try {
      if (isEditing) {
        await onUpdate(target.id, values);
        toast.success('Prescription updated');
      } else {
        await onCreate(values);
        toast.success('Prescription added');
      }
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the prescription');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={target !== undefined} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit prescription' : 'Add prescription'}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="rx-medication">Medication</Label>
            <Input
              id="rx-medication"
              value={values.medication}
              onChange={(e) => setValues({ ...values, medication: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="rx-dosage">Dosage</Label>
              <Input id="rx-dosage" value={values.dosage} onChange={(e) => setValues({ ...values, dosage: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="rx-frequency">Frequency</Label>
              <Input
                id="rx-frequency"
                value={values.frequency}
                onChange={(e) => setValues({ ...values, frequency: e.target.value })}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="rx-duration">Duration</Label>
            <Input id="rx-duration" value={values.duration} onChange={(e) => setValues({ ...values, duration: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="rx-instructions">Instructions (optional)</Label>
            <Textarea
              id="rx-instructions"
              rows={2}
              value={values.instructions}
              onChange={(e) => setValues({ ...values, instructions: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={!valid || submitting} onClick={() => void submit()}>
            {submitting ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
