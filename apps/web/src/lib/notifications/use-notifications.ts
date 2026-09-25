import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { unwrap, assertOk } from '@/lib/api-error';
import { invalidateAppointmentQueries } from '@/lib/appointments/use-appointments';
import { useRealtimeConnected } from '@/lib/realtime/realtime-provider';

const NOTIFICATIONS_LIST_KEY = ['notifications', 'list'] as const;
export const UNREAD_COUNT_KEY = ['notifications', 'unread-count'] as const;

function notificationsListKey(unreadOnly: boolean, page: number) {
  return [...NOTIFICATIONS_LIST_KEY, unreadOnly, page] as const;
}

function invalidateNotificationQueries(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_LIST_KEY });
  void queryClient.invalidateQueries({ queryKey: UNREAD_COUNT_KEY });
}

export function useNotifications(unreadOnly: boolean, page = 1, pageSize = 20) {
  return useQuery({
    queryKey: notificationsListKey(unreadOnly, page),
    queryFn: async () =>
      unwrap(await apiClient.GET('/notifications', { params: { query: { unreadOnly, page, pageSize } } })),
  });
}

/**
 * Polls once a minute only while the live connection is down — the fallback
 * required by the "Fallback without a live connection" scenario. While
 * connected, `notification:new`/`notifications:count` keep this query's
 * cached data current instead.
 */
export function useUnreadCount() {
  const connected = useRealtimeConnected();
  return useQuery({
    queryKey: UNREAD_COUNT_KEY,
    queryFn: async () => unwrap(await apiClient.GET('/notifications/unread-count')),
    refetchInterval: connected ? false : 60_000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap(await apiClient.POST('/notifications/{id}/read', { params: { path: { id } } })),
    onSuccess: () => {
      invalidateNotificationQueries(queryClient);
      invalidateAppointmentQueries(queryClient);
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => assertOk(await apiClient.POST('/notifications/read-all')),
    onSuccess: () => invalidateNotificationQueries(queryClient),
  });
}
