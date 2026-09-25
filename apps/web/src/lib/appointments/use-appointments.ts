import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiPaths } from 'api-client';
import { apiClient } from '@/lib/api-client';
import { unwrap } from '@/lib/api-error';

export type AppointmentScope = 'upcoming' | 'past';

type BookAppointmentBody = NonNullable<
  ApiPaths['/appointments']['post']['requestBody']
>['content']['application/json'];

type RescheduleAppointmentBody = NonNullable<
  ApiPaths['/appointments/{id}/reschedule']['post']['requestBody']
>['content']['application/json'];

type CancelAppointmentBody = NonNullable<
  ApiPaths['/appointments/{id}/cancel']['post']['requestBody']
>['content']['application/json'];

const APPOINTMENTS_LIST_KEY = ['appointments', 'list'] as const;

function appointmentsListKey(scope: AppointmentScope, page: number) {
  return [...APPOINTMENTS_LIST_KEY, scope, page] as const;
}

function appointmentDetailKey(id: string) {
  return ['appointments', 'detail', id] as const;
}

/** Every query that could be affected by a booking/reschedule/cancel mutation (also reused by the realtime provider). */
export function invalidateAppointmentQueries(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: APPOINTMENTS_LIST_KEY });
  void queryClient.invalidateQueries({
    predicate: (query) => query.queryKey[0] === 'appointments' && query.queryKey[1] === 'detail',
  });
  // Booking/cancelling changes which slots are offered.
  void queryClient.invalidateQueries({
    predicate: (query) => query.queryKey[0] === 'doctors' && query.queryKey[2] === 'slots',
  });
}

export function useAppointments(scope: AppointmentScope, page = 1, pageSize = 20) {
  return useQuery({
    queryKey: appointmentsListKey(scope, page),
    queryFn: async () =>
      unwrap(await apiClient.GET('/appointments', { params: { query: { scope, page, pageSize } } })),
  });
}

export function useAppointment(id: string | undefined) {
  return useQuery({
    queryKey: appointmentDetailKey(id ?? ''),
    queryFn: async () =>
      unwrap(await apiClient.GET('/appointments/{id}', { params: { path: { id: id! } } })),
    enabled: id !== undefined,
  });
}

export function useBookAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: BookAppointmentBody) => unwrap(await apiClient.POST('/appointments', { body })),
    onSuccess: () => invalidateAppointmentQueries(queryClient),
  });
}

export function useRescheduleAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: RescheduleAppointmentBody }) =>
      unwrap(await apiClient.POST('/appointments/{id}/reschedule', { params: { path: { id } }, body })),
    onSuccess: () => invalidateAppointmentQueries(queryClient),
  });
}

export function useCancelAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: CancelAppointmentBody }) =>
      unwrap(await apiClient.POST('/appointments/{id}/cancel', { params: { path: { id } }, body })),
    onSuccess: () => invalidateAppointmentQueries(queryClient),
  });
}
