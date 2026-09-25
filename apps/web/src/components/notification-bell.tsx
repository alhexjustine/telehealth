import { Link, useNavigate } from 'react-router';
import { formatDistanceToNow } from 'date-fns';
import { Bell } from 'lucide-react';
import type { ApiPaths } from 'api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatSlotDateTime } from '@/lib/format-slot-time';
import { roleHomePath } from '@/lib/auth/role-home';
import type { Role } from '@/lib/auth/types';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadCount,
} from '@/lib/notifications/use-notifications';

type NotificationDto =
  ApiPaths['/notifications']['get']['responses'][200]['content']['application/json']['items'][number];

const DROPDOWN_ITEM_COUNT = 10;

function startsAtLabel(data: NotificationDto['data']): string | undefined {
  if (!data || typeof data !== 'object' || !('startsAt' in data)) return undefined;
  const startsAt = (data as { startsAt?: unknown }).startsAt;
  return typeof startsAt === 'string' ? formatSlotDateTime(startsAt) : undefined;
}

/** Unread-count badge + recent-items dropdown, shown in every role header. */
export function NotificationBell({ role }: { role: Role }) {
  const navigate = useNavigate();
  const unreadCount = useUnreadCount();
  const notifications = useNotifications(false, 1, DROPDOWN_ITEM_COUNT);
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const count = unreadCount.data?.unreadCount ?? 0;

  async function openNotification(notification: NotificationDto) {
    if (!notification.readAt) {
      try {
        await markRead.mutateAsync(notification.id);
      } catch {
        // Still navigate even if marking read failed — the link is the point.
      }
    }
    if (notification.link) {
      void navigate(notification.link);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="relative size-9 p-0" aria-label="Notifications">
          <Bell className="size-4" />
          {count > 0 && (
            <Badge
              variant="destructive"
              className="absolute -right-1 -top-1 h-4 min-w-4 justify-center rounded-full px-1 text-[10px]"
            >
              {count > 99 ? '99+' : count}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-2 py-1.5">
          <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
          {count > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-auto border-none bg-transparent p-0 text-xs font-normal underline-offset-2 hover:bg-transparent hover:underline"
              onClick={() => void markAllRead.mutateAsync()}
            >
              Mark all as read
            </Button>
          )}
        </div>
        <DropdownMenuSeparator />
        {notifications.isPending && (
          <p className="px-2 py-4 text-center text-sm text-muted-foreground">Loading…</p>
        )}
        {notifications.data && notifications.data.items.length === 0 && (
          <p className="px-2 py-4 text-center text-sm text-muted-foreground">You&apos;re all caught up</p>
        )}
        {notifications.data?.items.map((notification) => (
          <DropdownMenuItem
            key={notification.id}
            className="flex flex-col items-start gap-0.5 whitespace-normal py-2"
            onSelect={() => void openNotification(notification)}
          >
            <div className="flex w-full items-center justify-between gap-2">
              <span className={notification.readAt ? 'font-normal' : 'font-medium'}>{notification.title}</span>
              {!notification.readAt && (
                <span className="size-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
              )}
            </div>
            <span className="text-xs text-muted-foreground">{notification.body}</span>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
              {startsAtLabel(notification.data) ? ` · ${startsAtLabel(notification.data)}` : ''}
            </span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to={`${roleHomePath(role)}/notifications`}>View all</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
