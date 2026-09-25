import { useState } from 'react';
import { useNavigate } from 'react-router';
import { formatDistanceToNow } from 'date-fns';
import type { ApiPaths } from 'api-client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useMarkNotificationRead, useNotifications } from '@/lib/notifications/use-notifications';
import { QueryState } from '@/components/query-state';

type NotificationDto =
  ApiPaths['/notifications']['get']['responses'][200]['content']['application/json']['items'][number];

const PAGE_SIZE = 20;

/**
 * `/{role}/notifications`: every notification, newest first, with an unread
 * filter and pagination. Mounted once per role area — `notification.link` is
 * already role-relative, so the page itself needs no role-specific logic.
 */
export function NotificationsPage() {
  const navigate = useNavigate();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);
  const notifications = useNotifications(unreadOnly, page, PAGE_SIZE);
  const markRead = useMarkNotificationRead();

  async function open(notification: NotificationDto) {
    if (!notification.readAt) {
      try {
        await markRead.mutateAsync(notification.id);
      } catch {
        // Still navigate even if marking read failed.
      }
    }
    if (notification.link) {
      void navigate(notification.link);
    }
  }

  const total = notifications.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Notifications</h1>
        <div className="flex items-center gap-2">
          <Checkbox
            id="unread-only"
            checked={unreadOnly}
            onCheckedChange={(checked) => {
              setUnreadOnly(checked === true);
              setPage(1);
            }}
          />
          <Label htmlFor="unread-only">Unread only</Label>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <QueryState
          query={notifications}
          label="notifications"
          isEmpty={(data) => data.items.length === 0}
          empty={
            <p className="text-muted-foreground">
              {unreadOnly ? 'No unread notifications.' : "You're all caught up."}
            </p>
          }
        >
          {(data) =>
            data.items.map((notification) => (
              <Card key={notification.id} className={notification.readAt ? undefined : 'border-primary/50'}>
                <CardContent
                  className="flex cursor-pointer flex-col gap-1 pt-6"
                  onClick={() => void open(notification)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{notification.title}</span>
                    {!notification.readAt && <Badge>Unread</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">{notification.body}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                  </p>
                </CardContent>
              </Card>
            ))
          }
        </QueryState>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
