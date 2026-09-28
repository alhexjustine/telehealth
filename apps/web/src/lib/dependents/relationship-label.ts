const LABELS: Record<string, string> = {
  CHILD: 'Child',
  PARENT: 'Parent',
  SPOUSE: 'Spouse',
  OTHER: 'Other',
};

/** A human-readable label for a `DependentRelationship` enum value. */
export function relationshipLabel(relationship: string): string {
  return LABELS[relationship] ?? relationship;
}
