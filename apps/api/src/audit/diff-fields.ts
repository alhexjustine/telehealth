/** The keys of `T` that `diffFields` is allowed to read, given as plain strings. */
export type FieldAllowList<T> = ReadonlyArray<keyof T & string>;

export interface FieldDiff {
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}

/**
 * Picks only the allow-listed fields that actually changed between `before`
 * and `after`, ready for `AuditService.record`'s `before`/`after`. This is
 * the one place that decides which fields an audit entry may ever contain:
 * a field not named in `allowList` is never read, even if present on the
 * input objects — so a caller accidentally handing this a full `User` or
 * `Appointment` row (password hash, session tokens, clinical fields and
 * all) still can't leak them into the log. Unchanged fields are omitted
 * entirely, so the entry only documents what the action actually did.
 */
export function diffFields<T extends object>(
  before: Partial<T> | null | undefined,
  after: Partial<T> | null | undefined,
  allowList: FieldAllowList<T>,
): FieldDiff {
  const diffBefore: Record<string, unknown> = {};
  const diffAfter: Record<string, unknown> = {};

  for (const key of allowList) {
    const beforeValue = before?.[key] ?? null;
    const afterValue = after?.[key] ?? null;
    if (!valuesEqual(beforeValue, afterValue)) {
      diffBefore[key] = normalize(beforeValue);
      diffAfter[key] = normalize(afterValue);
    }
  }

  return { before: diffBefore, after: diffAfter };
}

function normalize(value: unknown): unknown {
  return value instanceof Date ? value.toISOString() : value;
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((value, index) => valuesEqual(value, b[index]));
  }
  return false;
}
