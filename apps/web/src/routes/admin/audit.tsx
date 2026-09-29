import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatSlotDateTime } from '@/lib/format-slot-time';
import { useAdminAuditLog, type AdminAuditListQuery } from '@/lib/admin/use-admin-audit';
import { QueryState } from '@/components/query-state';
import { Pagination } from '@/components/pagination';

const PAGE_SIZE = 5;

// Mirrors apps/api/src/audit/audit-entity-type.ts's `AuditEntityType` — the
// only values `AuditLog.entityType` is ever stored as, and the API filters
// on an exact, case-sensitive match against them.
const ENTITY_TYPES = ['User', 'DoctorProfile', 'Appointment', 'DoctorReview'] as const;

// The API validates `entityId` with `@IsUUID('4')` and rejects (400) any
// value that isn't a complete UUID v4 — so the input below withholds partial
// text from the query instead of firing a request on every keystroke.
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ENTITY_ID_DEBOUNCE_MS = 400;

// Mirrors the Prisma-generated `AuditAction` enum (apps/api/src/generated/prisma/enums.ts,
// gitignored and API-only, so the values are duplicated here for the filter dropdown).
const ACTIONS = [
  'USER_STATUS_CHANGED',
  'DOCTOR_APPROVED',
  'DOCTOR_REJECTED',
  'DOCTOR_PROFILE_UPDATED',
  'APPOINTMENT_CANCELLED',
  'APPOINTMENT_MARKED_NOT_HELD',
  'ADMIN_SIGNED_IN',
  'REVIEW_HIDDEN',
  'REVIEW_UNHIDDEN',
] as const;

const ALL_VALUE = '__all__';

function humanizeAction(action: string): string {
  return action
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

type AuditEntry = NonNullable<ReturnType<typeof useAdminAuditLog>['data']>['items'][number];

function diffRows(before: Record<string, unknown> | null, after: Record<string, unknown> | null) {
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  return [...keys].map((key) => ({
    field: key,
    before: before?.[key],
    after: after?.[key],
  }));
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (Array.isArray(value)) return value.length === 0 ? '(none)' : value.join(', ');
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
}

export function AdminAuditPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selected, setSelected] = useState<AuditEntry | undefined>(undefined);
  const entityIdParam = searchParams.get('entityId') ?? '';
  const [entityIdInput, setEntityIdInput] = useState(entityIdParam);
  // Resets the free-typed box when the filter changes from outside it
  // (Clear filters, browser back/forward) — adjusting state during render
  // rather than in an effect, per https://react.dev/learn/you-might-not-need-an-effect.
  const [syncedEntityIdParam, setSyncedEntityIdParam] = useState(entityIdParam);
  if (entityIdParam !== syncedEntityIdParam) {
    setSyncedEntityIdParam(entityIdParam);
    setEntityIdInput(entityIdParam);
  }

  const query: AdminAuditListQuery = {
    action: (searchParams.get('action') as AdminAuditListQuery['action']) || undefined,
    entityType: searchParams.get('entityType') || undefined,
    entityId: searchParams.get('entityId') || undefined,
    page: Number(searchParams.get('page') ?? '1') || 1,
    pageSize: PAGE_SIZE,
  };
  const audit = useAdminAuditLog(query);

  function goToPage(page: number) {
    const next = new URLSearchParams(searchParams);
    if (page > 1) next.set('page', String(page));
    else next.delete('page');
    setSearchParams(next);
  }

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page');
    setSearchParams(next);
  }

  // Debounces committing the Record ID box to the query, and withholds
  // partial/invalid text entirely — the API 400s on anything but a
  // complete UUID v4, so typing would otherwise error on every keystroke.
  useEffect(() => {
    const trimmed = entityIdInput.trim();
    if (trimmed !== '' && !UUID_V4_PATTERN.test(trimmed)) return;
    if (trimmed === entityIdParam) return;
    const timeout = setTimeout(() => updateParam('entityId', trimmed), ENTITY_ID_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityIdInput]);

  const entityIdHasInvalidText = entityIdInput.trim() !== '' && !UUID_V4_PATTERN.test(entityIdInput.trim());
  const hasActiveFilter = Boolean(
    searchParams.get('action') || searchParams.get('entityType') || searchParams.get('entityId'),
  );

  function clearFilters() {
    const next = new URLSearchParams(searchParams);
    next.delete('action');
    next.delete('entityType');
    next.delete('entityId');
    next.delete('page');
    setSearchParams(next);
    setEntityIdInput('');
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Audit log</h1>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="audit-action">Action</Label>
              <Select
                value={searchParams.get('action') ?? ALL_VALUE}
                onValueChange={(value) => updateParam('action', value === ALL_VALUE ? '' : value)}
              >
                <SelectTrigger id="audit-action" className="w-full">
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>All actions</SelectItem>
                  {ACTIONS.map((action) => (
                    <SelectItem key={action} value={action}>
                      {humanizeAction(action)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="audit-entity-type">Record type</Label>
              <Select
                value={searchParams.get('entityType') ?? ALL_VALUE}
                onValueChange={(value) => updateParam('entityType', value === ALL_VALUE ? '' : value)}
              >
                <SelectTrigger id="audit-entity-type" className="w-full">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>All types</SelectItem>
                  {ENTITY_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="audit-entity-id">Record ID</Label>
              <Input
                id="audit-entity-id"
                placeholder="Paste a full record ID"
                value={entityIdInput}
                onChange={(e) => setEntityIdInput(e.target.value)}
                aria-invalid={entityIdHasInvalidText}
              />
              {entityIdHasInvalidText && (
                <p className="text-xs text-destructive">Enter the record&apos;s full ID to filter by it.</p>
              )}
            </div>
          </div>

          {hasActiveFilter && (
            <Button type="button" variant="outline" size="sm" className="self-start" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </CardContent>
      </Card>

      <QueryState
        query={audit}
        label="audit entries"
        isEmpty={(data) => data.items.length === 0}
        empty={<p className="text-muted-foreground">No matching entries.</p>}
      >
        {(data) => (
          <div className="flex flex-col gap-2">
            {data.items.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setSelected(entry)}
                className="text-left"
              >
                <Card className="transition-colors hover:bg-accent/50">
                  <CardContent className="flex flex-col gap-1 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{entry.action}</Badge>
                        <span className="text-sm text-muted-foreground">
                          {entry.entityType}
                          {entry.entityId ? ` · ${entry.entityId.slice(0, 8)}…` : ''}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">by {entry.actorEmail}</p>
                      {entry.reason && <p className="text-sm">{entry.reason}</p>}
                    </div>
                    <span className="text-sm text-muted-foreground">{formatSlotDateTime(entry.createdAt)}</span>
                  </CardContent>
                </Card>
              </button>
            ))}
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={goToPage} />
          </div>
        )}
      </QueryState>

      <Dialog open={selected !== undefined} onOpenChange={(open) => !open && setSelected(undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selected?.action}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="flex flex-col gap-3 text-sm">
              <p className="text-muted-foreground">
                {selected.actorEmail} · {formatSlotDateTime(selected.createdAt)}
              </p>
              {selected.reason && <p>Reason: {selected.reason}</p>}
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-1 pr-2">Field</th>
                    <th className="py-1 pr-2">Before</th>
                    <th className="py-1">After</th>
                  </tr>
                </thead>
                <tbody>
                  {diffRows(selected.before, selected.after).map((row) => (
                    <tr key={row.field} className="border-b last:border-0">
                      <td className="py-1 pr-2 font-medium">{row.field}</td>
                      <td className="py-1 pr-2 text-muted-foreground">{formatValue(row.before)}</td>
                      <td className="py-1">{formatValue(row.after)}</td>
                    </tr>
                  ))}
                  {diffRows(selected.before, selected.after).length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-2 text-muted-foreground">
                        No field changes recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
