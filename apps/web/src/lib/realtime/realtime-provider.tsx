import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { ApiPaths } from 'api-client';
import { invalidateAppointmentQueries } from '@/lib/appointments/use-appointments';
import { UNREAD_COUNT_KEY } from '@/lib/notifications/use-notifications';

type NotificationDto =
  ApiPaths['/notifications']['get']['responses'][200]['content']['application/json']['items'][number];

interface NotificationNewPayload {
  notification: NotificationDto;
  unreadCount: number;
}

interface NotificationsCountPayload {
  unreadCount: number;
}

const NOTIFICATIONS_LIST_KEY = ['notifications', 'list'] as const;

const RealtimeContext = createContext<{ connected: boolean } | undefined>(undefined);

/**
 * Connects a single socket.io-client for the whole authenticated session
 * (mounted once, inside `RoleAreaLayout`, so it covers every role). On
 * `notification:new` it updates the unread-count cache, invalidates the
 * notifications list and any appointment queries, and shows a toast; on
 * `notifications:count` (pushed after mark-read/mark-all from another tab)
 * it just updates the count. See design.md's "Web".
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | undefined>(undefined);

  useEffect(() => {
    const socket = io({ path: '/socket.io', withCredentials: true });
    socketRef.current = socket;

    const handleConnect = () => setConnected(true);
    const handleDisconnect = () => setConnected(false);
    const handleNew = (payload: NotificationNewPayload) => {
      queryClient.setQueryData<NotificationsCountPayload>(UNREAD_COUNT_KEY, { unreadCount: payload.unreadCount });
      void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_LIST_KEY });
      invalidateAppointmentQueries(queryClient);
      toast(payload.notification.title, { description: payload.notification.body });
    };
    const handleCount = (payload: NotificationsCountPayload) => {
      queryClient.setQueryData<NotificationsCountPayload>(UNREAD_COUNT_KEY, payload);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('notification:new', handleNew);
    socket.on('notifications:count', handleCount);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('notification:new', handleNew);
      socket.off('notifications:count', handleCount);
      socket.disconnect();
      socketRef.current = undefined;
    };
  }, [queryClient]);

  return <RealtimeContext.Provider value={{ connected }}>{children}</RealtimeContext.Provider>;
}

/** Whether the live connection is currently up — drives the unread-count query's polling fallback. */
export function useRealtimeConnected(): boolean {
  return useContext(RealtimeContext)?.connected ?? false;
}
