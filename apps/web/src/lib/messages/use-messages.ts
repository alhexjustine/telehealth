import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { ApiPaths } from 'api-client';
import { apiClient } from '@/lib/api-client';
import { unwrap } from '@/lib/api-error';

type SendMessageBody = NonNullable<
  ApiPaths['/appointments/{appointmentId}/messages']['post']['requestBody']
>['content']['application/json'];

export type MessageListDto =
  ApiPaths['/appointments/{appointmentId}/messages']['get']['responses'][200]['content']['application/json'];
export type MessageDto = MessageListDto['items'][number];

const THREAD_PAGE_SIZE = 100;

export function messagesKey(appointmentId: string) {
  return ['appointments', appointmentId, 'messages'] as const;
}

export function useAppointmentMessages(appointmentId: string | undefined) {
  return useQuery({
    queryKey: messagesKey(appointmentId ?? ''),
    queryFn: async () =>
      unwrap(
        await apiClient.GET('/appointments/{appointmentId}/messages', {
          params: { path: { appointmentId: appointmentId! }, query: { pageSize: THREAD_PAGE_SIZE } },
        }),
      ),
    enabled: appointmentId !== undefined,
  });
}

/** Appends `message` to the cached thread if it isn't there yet — shared by the send mutation and the live socket handler so neither path can duplicate the other's message. */
export function appendMessage(queryClient: QueryClient, appointmentId: string, message: MessageDto): void {
  queryClient.setQueryData<MessageListDto>(messagesKey(appointmentId), (old) => {
    if (!old) return old;
    if (old.items.some((item) => item.id === message.id)) return old;
    return { ...old, items: [...old.items, message], total: old.total + 1 };
  });
}

export function useSendMessage(appointmentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: SendMessageBody) =>
      unwrap(
        await apiClient.POST('/appointments/{appointmentId}/messages', {
          params: { path: { appointmentId } },
          body,
        }),
      ),
    onSuccess: (message) => appendMessage(queryClient, appointmentId, message),
  });
}
