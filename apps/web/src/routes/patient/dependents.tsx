import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { QueryState } from '@/components/query-state';
import {
  useAddDependent,
  useDependents,
  useRemoveDependent,
  useUpdateDependent,
  type DependentDto,
} from '@/lib/dependents/use-dependents';
import { relationshipLabel } from '@/lib/dependents/relationship-label';
import { ageFromBirthDate } from '@/lib/dependents/age';
import { BirthDateSelect } from '@/components/birth-date-select';

const RELATIONSHIPS = ['CHILD', 'PARENT', 'SPOUSE', 'OTHER'] as const;
const selectClassName =
  'h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

export function PatientDependentsPage() {
  const dependents = useDependents();
  const [editTarget, setEditTarget] = useState<DependentDto | 'new' | undefined>(undefined);
  const [removeTarget, setRemoveTarget] = useState<DependentDto | undefined>(undefined);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dependents</h1>
        <Button type="button" size="sm" onClick={() => setEditTarget('new')}>
          Add dependent
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Add a child, parent, spouse, or someone else you book appointments for. They don&apos;t need
        their own account — you manage everything on their behalf.
      </p>

      <QueryState
        query={dependents}
        label="dependents"
        isEmpty={(data) => data.items.length === 0}
        empty={<p className="text-muted-foreground">You haven&apos;t added any dependents yet.</p>}
      >
        {(data) => (
          <div className="flex flex-col gap-3">
            {data.items.map((dependent) => (
              <Card key={dependent.id}>
                <CardContent className="flex items-center justify-between gap-2 pt-6">
                  <div>
                    <p className="font-medium">
                      {dependent.firstName} {dependent.lastName}
                    </p>
                    <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                      <Badge variant="secondary">{relationshipLabel(dependent.relationship)}</Badge>
                      <span>{ageFromBirthDate(dependent.birthDate)} years old</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setEditTarget(dependent)}>
                      Edit
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => setRemoveTarget(dependent)}>
                      Remove
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </QueryState>

      <DependentFormDialog target={editTarget} onClose={() => setEditTarget(undefined)} />
      <RemoveDependentDialog target={removeTarget} onClose={() => setRemoveTarget(undefined)} />
    </div>
  );
}

function DependentFormDialog({
  target,
  onClose,
}: {
  target: DependentDto | 'new' | undefined;
  onClose: () => void;
}) {
  const addDependent = useAddDependent();
  const updateDependent = useUpdateDependent();
  const isNew = target === 'new';
  const editing = target !== undefined && target !== 'new' ? target : undefined;

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [relationship, setRelationship] = useState<(typeof RELATIONSHIPS)[number]>('CHILD');
  const [medicalConditions, setMedicalConditions] = useState('');
  const [allergies, setAllergies] = useState('');
  const [currentMedications, setCurrentMedications] = useState('');

  // Reset the form to the target's values (or blank, for "new") whenever a
  // different dialog target opens — a ref-less alternative to an effect,
  // since `target` itself is the only thing that should trigger this.
  const [lastTarget, setLastTarget] = useState(target);
  if (target !== lastTarget) {
    setLastTarget(target);
    setFirstName(editing?.firstName ?? '');
    setLastName(editing?.lastName ?? '');
    setBirthDate(editing?.birthDate ?? '');
    setRelationship(editing?.relationship ?? 'CHILD');
    setMedicalConditions(editing?.medicalConditions ?? '');
    setAllergies(editing?.allergies ?? '');
    setCurrentMedications(editing?.currentMedications ?? '');
  }

  const pending = addDependent.isPending || updateDependent.isPending;
  const valid = firstName.trim().length > 0 && lastName.trim().length > 0 && birthDate !== '';

  async function submit() {
    if (!valid) return;
    const body = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      birthDate,
      relationship,
      medicalConditions: medicalConditions.trim() || undefined,
      allergies: allergies.trim() || undefined,
      currentMedications: currentMedications.trim() || undefined,
    };
    try {
      if (isNew) {
        await addDependent.mutateAsync(body);
        toast.success('Dependent added');
      } else if (editing) {
        await updateDependent.mutateAsync({ id: editing.id, body });
        toast.success('Dependent updated');
      }
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save this dependent');
    }
  }

  return (
    <Dialog open={target !== undefined} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isNew ? 'Add a dependent' : 'Edit dependent'}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="dependent-first-name">First name</Label>
              <Input id="dependent-first-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="dependent-last-name">Last name</Label>
              <Input id="dependent-last-name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label>Birthdate</Label>
            <BirthDateSelect label="Birthdate" value={birthDate} onChange={setBirthDate} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="dependent-relationship">Relationship</Label>
            <select
              id="dependent-relationship"
              className={selectClassName}
              value={relationship}
              onChange={(e) => setRelationship(e.target.value as (typeof RELATIONSHIPS)[number])}
            >
              {RELATIONSHIPS.map((value) => (
                <option key={value} value={value}>
                  {relationshipLabel(value)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="dependent-conditions">Medical conditions (optional)</Label>
            <Textarea
              id="dependent-conditions"
              rows={2}
              value={medicalConditions}
              onChange={(e) => setMedicalConditions(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="dependent-allergies">Allergies (optional)</Label>
            <Textarea id="dependent-allergies" rows={2} value={allergies} onChange={(e) => setAllergies(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="dependent-medications">Current medications (optional)</Label>
            <Textarea
              id="dependent-medications"
              rows={2}
              value={currentMedications}
              onChange={(e) => setCurrentMedications(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={!valid || pending} onClick={() => void submit()}>
            {pending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RemoveDependentDialog({ target, onClose }: { target: DependentDto | undefined; onClose: () => void }) {
  const removeDependent = useRemoveDependent();

  async function confirm() {
    if (!target) return;
    try {
      await removeDependent.mutateAsync(target.id);
      toast.success('Dependent removed');
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not remove this dependent');
    }
  }

  return (
    <Dialog open={target !== undefined} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove {target ? `${target.firstName} ${target.lastName}` : 'this dependent'}?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          They won&apos;t be available for new bookings, but their existing appointments and records
          are kept.
        </p>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Keep dependent
          </Button>
          <Button type="button" disabled={removeDependent.isPending} onClick={() => void confirm()}>
            {removeDependent.isPending ? 'Removing…' : 'Remove'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
