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

interface RealtimeContextValue {
  connected: boolean;
  /** The single shared socket, reused by feature-specific hooks (e.g. the consultation workspace) instead of opening a second connection. */
  socket: Socket | undefined;
}

const RealtimeContext = createContext<RealtimeContextValue | undefined>(undefined);

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
  const [socket, setSocket] = useState<Socket | undefined>(undefined);
  const socketRef = useRef<Socket | undefined>(undefined);

  useEffect(() => {
    const socket = io({ path: '/socket.io', withCredentials: true });
    socketRef.current = socket;
    // Exposes the socket this effect just created to context consumers (e.g.
    // the consultation workspace's subscribe hook), which need the instance
    // itself, not just the `connected` flag — the socket accepts emits
    // (queued client-side) before "connect" fires. Runs once per connect
    // effect, not on every render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSocket(socket);

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
      setSocket(undefined);
    };
  }, [queryClient]);

  return <RealtimeContext.Provider value={{ connected, socket }}>{children}</RealtimeContext.Provider>;
}

/** Whether the live connection is currently up — drives the unread-count query's polling fallback. */
export function useRealtimeConnected(): boolean {
  return useContext(RealtimeContext)?.connected ?? false;
}

/** The shared socket.io connection, for hooks that need to emit/listen directly (e.g. the consultation workspace). `undefined` until the provider's effect has run. */
export function useRealtimeSocket(): Socket | undefined {
  return useContext(RealtimeContext)?.socket;
}
