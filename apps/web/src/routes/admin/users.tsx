import { useState } from 'react';
import { useSearchParams } from 'react-router';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAdminUsers, useChangeAccountStatus, type AdminUserListQuery } from '@/lib/admin/use-admin-users';
import { AdminAuditLink } from '@/components/admin/audit-link';
import { QueryState } from '@/components/query-state';

type AdminUserItem = NonNullable<ReturnType<typeof useAdminUsers>['data']>['items'][number];
type TargetStatus = 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';

const REASON_MIN_LENGTH = 5;
const selectClassName =
  'h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' {
  if (status === 'ACTIVE') return 'default';
  if (status === 'SUSPENDED') return 'secondary';
  return 'destructive';
}

export function AdminUsersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [qInput, setQInput] = useState(searchParams.get('q') ?? '');
  const [dialogTarget, setDialogTarget] = useState<{ user: AdminUserItem; status: TargetStatus } | undefined>(undefined);

  const query: AdminUserListQuery = {
    q: searchParams.get('q') || undefined,
    role: (searchParams.get('role') as AdminUserListQuery['role']) || undefined,
    status: (searchParams.get('status') as AdminUserListQuery['status']) || undefined,
    page: Number(searchParams.get('page') ?? '1') || 1,
    pageSize: 20,
  };
  const users = useAdminUsers(query);

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page');
    setSearchParams(next);
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Users</h1>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 pt-6">
          <div className="flex flex-col gap-1">
            <Label htmlFor="admin-users-q">Search</Label>
            <div className="flex gap-2">
              <Input
                id="admin-users-q"
                placeholder="Name or email"
                value={qInput}
                onChange={(e) => setQInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') updateParam('q', qInput);
                }}
                className="w-56"
              />
              <Button type="button" variant="outline" onClick={() => updateParam('q', qInput)}>
                Search
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="admin-users-role">Role</Label>
            <select
              id="admin-users-role"
              className={selectClassName}
              value={searchParams.get('role') ?? ''}
              onChange={(e) => updateParam('role', e.target.value)}
            >
              <option value="">All roles</option>
              <option value="PATIENT">Patient</option>
              <option value="DOCTOR">Doctor</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="admin-users-status">Status</Label>
            <select
              id="admin-users-status"
              className={selectClassName}
              value={searchParams.get('status') ?? ''}
              onChange={(e) => updateParam('status', e.target.value)}
            >
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="DEACTIVATED">Deactivated</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <QueryState
        query={users}
        label="accounts"
        isEmpty={(data) => data.items.length === 0}
        empty={<p className="text-muted-foreground">No accounts match your filters.</p>}
      >
        {(data) => (
          <div className="flex flex-col gap-3">
            {data.items.map((user) => (
              <Card key={user.id}>
                <CardContent className="flex flex-col gap-2 pt-6 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{user.displayName}</span>
                      <Badge variant="outline">{user.role}</Badge>
                      <Badge variant={statusVariant(user.status)}>{user.status}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                    {user.statusReason && (
                      <p className="text-sm text-muted-foreground">Reason: {user.statusReason}</p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      {user.upcomingAppointmentCount} upcoming appointment(s)
                    </p>
                    <AdminAuditLink entityType="User" entityId={user.id} />
                  </div>
                  {user.role !== 'ADMIN' && (
                    <div className="flex flex-wrap gap-2">
                      {user.status !== 'ACTIVE' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setDialogTarget({ user, status: 'ACTIVE' })}
                        >
                          Reactivate
                        </Button>
                      )}
                      {user.status !== 'SUSPENDED' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setDialogTarget({ user, status: 'SUSPENDED' })}
                        >
                          Suspend
                        </Button>
                      )}
                      {user.status !== 'DEACTIVATED' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-destructive text-destructive hover:bg-destructive/10"
                          onClick={() => setDialogTarget({ user, status: 'DEACTIVATED' })}
                        >
                          Deactivate
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </QueryState>

      <AccountStatusDialog target={dialogTarget} onClose={() => setDialogTarget(undefined)} />
    </div>
  );
}

function AccountStatusDialog({
  target,
  onClose,
}: {
  target: { user: AdminUserItem; status: TargetStatus } | undefined;
  onClose: () => void;
}) {
  const changeStatus = useChangeAccountStatus();
  const [reason, setReason] = useState('');
  const reasonValid = reason.trim().length >= REASON_MIN_LENGTH;

  async function confirm() {
    if (!target || !reasonValid) return;
    try {
      await changeStatus.mutateAsync({ id: target.user.id, body: { status: target.status, reason: reason.trim() } });
      toast.success('Account status updated');
      setReason('');
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not change the account status');
    }
  }

  const verb = target?.status === 'DEACTIVATED' ? 'Deactivate' : target?.status === 'SUSPENDED' ? 'Suspend' : 'Reactivate';

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
          <DialogTitle>
            {verb} {target?.user.displayName}?
          </DialogTitle>
          {target?.status === 'DEACTIVATED' && (
            <DialogDescription>
              This will cancel {target.user.upcomingAppointmentCount} upcoming appointment
              {target.user.upcomingAppointmentCount === 1 ? '' : 's'}
              {target.user.upcomingAppointmentCount > 0 ? ' and notify the other participant.' : '.'}
            </DialogDescription>
          )}
        </DialogHeader>
        <div className="flex flex-col gap-1">
          <Label htmlFor="account-status-reason">Reason</Label>
          <Textarea id="account-status-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          {!reasonValid && reason.length > 0 && (
            <p className="text-sm text-destructive">At least {REASON_MIN_LENGTH} characters are required.</p>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={!reasonValid || changeStatus.isPending} onClick={() => void confirm()}>
            {changeStatus.isPending ? 'Saving…' : `${verb} account`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
