import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiPaths } from 'api-client';
import { apiClient } from '@/lib/api-client';
import { unwrap } from '@/lib/api-error';

export type AdminAppointmentListQuery = NonNullable<ApiPaths['/admin/appointments']['get']['parameters']['query']>;
type AdminCancelBody = NonNullable<
  ApiPaths['/admin/appointments/{id}/cancel']['post']['requestBody']
>['content']['application/json'];
type MarkNotHeldBody = NonNullable<
  ApiPaths['/admin/appointments/{id}/mark-not-held']['post']['requestBody']
>['content']['application/json'];

const ADMIN_APPOINTMENTS_KEY = ['admin', 'appointments'] as const;

export function useAdminAppointments(query: AdminAppointmentListQuery) {
  return useQuery({
    queryKey: [...ADMIN_APPOINTMENTS_KEY, 'list', query],
    queryFn: async () => unwrap(await apiClient.GET('/admin/appointments', { params: { query } })),
  });
}

export function useAdminCancelAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: AdminCancelBody }) =>
      unwrap(await apiClient.POST('/admin/appointments/{id}/cancel', { params: { path: { id } }, body })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ADMIN_APPOINTMENTS_KEY });
    },
  });
}

export function useMarkNotHeld() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: MarkNotHeldBody }) =>
      unwrap(await apiClient.POST('/admin/appointments/{id}/mark-not-held', { params: { path: { id } }, body })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ADMIN_APPOINTMENTS_KEY });
    },
  });
}
