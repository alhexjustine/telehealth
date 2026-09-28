import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiPaths } from 'api-client';
import { apiClient } from '@/lib/api-client';
import { unwrap } from '@/lib/api-error';

export type RefillRequestDto =
  ApiPaths['/doctors/me/refill-requests']['get']['responses'][200]['content']['application/json']['items'][number];
type RefillStatus = NonNullable<ApiPaths['/doctors/me/refill-requests']['get']['parameters']['query']>['status'];

export const DOCTOR_REFILL_REQUESTS_KEY = ['doctor-refill-requests'] as const;

export function useDoctorRefillRequests(status?: RefillStatus) {
  return useQuery({
    queryKey: [...DOCTOR_REFILL_REQUESTS_KEY, status ?? ''] as const,
    queryFn: async () =>
      unwrap(await apiClient.GET('/doctors/me/refill-requests', { params: { query: { status } } })),
  });
}

export function useApproveRefill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, doctorNote }: { id: string; doctorNote?: string }) =>
      unwrap(
        await apiClient.POST('/doctors/me/refill-requests/{id}/approve', {
          params: { path: { id } },
          body: { doctorNote },
        }),
      ),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: DOCTOR_REFILL_REQUESTS_KEY }),
  });
}

export function useDenyRefill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, doctorNote }: { id: string; doctorNote?: string }) =>
      unwrap(
        await apiClient.POST('/doctors/me/refill-requests/{id}/deny', {
          params: { path: { id } },
          body: { doctorNote },
        }),
      ),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: DOCTOR_REFILL_REQUESTS_KEY }),
  });
}
