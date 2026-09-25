import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import type { ApiPaths } from 'api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useSymptomCatalog } from '@/lib/matching/use-symptoms';
import { useMatching } from '@/lib/matching/use-matching';
import { formatSlotDateTime } from '@/lib/format-slot-time';
import { QueryState } from '@/components/query-state';

type MatchingResponse =
  ApiPaths['/matching']['post']['responses'][200]['content']['application/json'];

const DESCRIPTION_MAX_LENGTH = 1000;

export function FindCarePage() {
  const catalog = useSymptomCatalog();
  const matching = useMatching();

  const [chipFilter, setChipFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [result, setResult] = useState<MatchingResponse | undefined>(undefined);

  const filteredGroups = useMemo(() => {
    if (!catalog.data) return [];
    const filter = chipFilter.trim().toLowerCase();
    if (!filter) return catalog.data;
    return catalog.data
      .map((group) => ({
        ...group,
        symptoms: group.symptoms.filter((s) => s.name.toLowerCase().includes(filter)),
      }))
      .filter((group) => group.symptoms.length > 0);
  }, [catalog.data, chipFilter]);

  function toggleSymptom(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  async function submit() {
    setAcknowledged(false);
    const response = await matching.mutateAsync({
      symptomIds: selectedIds,
      descriptionText: description.trim() === '' ? undefined : description,
    });
    setResult(response);
  }

  const canSubmit = selectedIds.length > 0 || description.trim() !== '';

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Find care</h1>
        <p className="text-sm text-muted-foreground">
          Tell us what you're experiencing and we'll suggest specializations and doctors.
        </p>
      </div>

      <Alert>
        <AlertTitle>This is guidance, not a diagnosis</AlertTitle>
        <AlertDescription>
          These suggestions are based on simple rules, not a medical evaluation. If you're
          concerned about your health, contact a doctor or emergency services.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>What are you experiencing?</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="symptom-filter">Filter symptoms</Label>
            <Input
              id="symptom-filter"
              placeholder="Search symptoms"
              value={chipFilter}
              onChange={(e) => setChipFilter(e.target.value)}
              className="max-w-xs"
            />
          </div>

          <QueryState
            query={catalog}
            label="symptoms"
            isEmpty={(data) => data.length === 0}
            empty={<p className="text-muted-foreground">The symptom list is not available right now.</p>}
          >
            {() => (
              <div className="flex flex-col gap-3">
                {filteredGroups.map((group) => (
                  <div key={group.category}>
                    <p className="mb-1 text-sm font-medium text-muted-foreground">{group.category}</p>
                    <div className="flex flex-wrap gap-2">
                      {group.symptoms.map((symptom) => {
                        const selected = selectedIds.includes(symptom.id);
                        return (
                          <button
                            key={symptom.id}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => toggleSymptom(symptom.id)}
                            className={`rounded-full border px-3 py-1 text-sm ${
                              selected
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-input hover:bg-accent'
                            }`}
                          >
                            {symptom.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </QueryState>

          <div className="flex flex-col gap-1">
            <Label htmlFor="symptom-description">Describe how you feel (optional)</Label>
            <Textarea
              id="symptom-description"
              value={description}
              maxLength={DESCRIPTION_MAX_LENGTH}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
            <p className="text-right text-xs text-muted-foreground">
              {description.length}/{DESCRIPTION_MAX_LENGTH}
            </p>
          </div>

          <Button type="button" onClick={() => void submit()} disabled={!canSubmit || matching.isPending}>
            {matching.isPending ? 'Checking…' : 'Get suggestions'}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <div className="flex flex-col gap-4">
          {result.urgent && (
            <Alert variant="destructive">
              <AlertTitle>This may need urgent attention</AlertTitle>
              <AlertDescription>
                <p>{result.emergencyMessage}</p>
                <label className="mt-2 flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={acknowledged}
                    onCheckedChange={(checked) => setAcknowledged(checked === true)}
                  />
                  I have read this warning
                </label>
              </AlertDescription>
            </Alert>
          )}

          {result.ageUnknown && (
            <Alert>
              <AlertTitle>Add your birthday for better suggestions</AlertTitle>
              <AlertDescription>
                <Link to="/patient/profile" className="text-primary underline-offset-4 hover:underline">
                  Complete your profile
                </Link>{' '}
                so age-specific rules (like routing to Pediatrics) can apply.
              </AlertDescription>
            </Alert>
          )}

          {result.matchedSymptoms.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Matched symptoms</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {result.matchedSymptoms.map((m) => (
                  <Badge key={m.symptomId} variant="secondary">
                    {m.symptomName} ({m.source})
                  </Badge>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Suggested specializations</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {result.specializations.map((s) => (
                <details key={s.specializationId} className="rounded-md border border-input p-3">
                  <summary className="cursor-pointer font-medium">
                    {s.specializationName} <span className="text-muted-foreground">(score {s.score})</span>
                  </summary>
                  <ul className="mt-2 flex flex-col gap-1 text-sm text-muted-foreground">
                    {s.reasons.map((reason, index) => (
                      <li key={index}>
                        {reason.symptomName
                          ? `${reason.symptomName} → ${reason.specializationName}`
                          : reason.source === 'age'
                            ? `Age-based rule → ${reason.specializationName}`
                            : `No specific match → ${reason.specializationName}`}
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
            </CardContent>
          </Card>

          {(!result.urgent || acknowledged) && (
            <Card>
              <CardHeader>
                <CardTitle>Doctors</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {result.doctors.length === 0 && (
                  <p className="text-muted-foreground">No approved doctors match right now.</p>
                )}
                {result.doctors.map((doctor) => (
                  <Link
                    key={doctor.doctorId}
                    to={`/patient/doctors/${doctor.doctorId}?symptoms=${selectedIds.join(',')}`}
                    className="rounded-md border border-input p-3 hover:bg-accent/50"
                  >
                    <p className="font-medium">{doctor.displayName}</p>
                    <p className="text-sm text-muted-foreground">
                      Suggested for: {doctor.reasons.map((r) => r.specializationName).join(', ')}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {doctor.nextAvailableSlot
                        ? `Next available: ${formatSlotDateTime(doctor.nextAvailableSlot)}`
                        : 'No upcoming availability'}
                    </p>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
