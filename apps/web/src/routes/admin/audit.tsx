import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatSlotDateTime } from '@/lib/format-slot-time';
import { useAdminAuditLog, type AdminAuditListQuery } from '@/lib/admin/use-admin-audit';
import { QueryState } from '@/components/query-state';
import { Pagination } from '@/components/pagination';

const PAGE_SIZE = 5;

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

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Audit log</h1>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 pt-6">
          <div className="flex flex-col gap-1">
            <Label htmlFor="audit-entity-type">Record type</Label>
            <Input
              id="audit-entity-type"
              placeholder="User, DoctorProfile, Appointment"
              value={searchParams.get('entityType') ?? ''}
              onChange={(e) => updateParam('entityType', e.target.value)}
              className="w-56"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="audit-entity-id">Record ID</Label>
            <Input
              id="audit-entity-id"
              value={searchParams.get('entityId') ?? ''}
              onChange={(e) => updateParam('entityId', e.target.value)}
              className="w-64"
            />
          </div>
          {(searchParams.get('entityType') || searchParams.get('entityId')) && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const next = new URLSearchParams(searchParams);
                next.delete('entityType');
                next.delete('entityId');
                setSearchParams(next);
              }}
            >
              Clear filter
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
