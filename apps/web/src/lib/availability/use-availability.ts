import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiPaths } from 'api-client';
import { apiClient } from '@/lib/api-client';
import { assertOk, unwrap } from '@/lib/api-error';

export const AVAILABILITY_QUERY_KEY = ['doctors', 'me', 'availability'] as const;

type SaveAvailabilityBody = NonNullable<
  ApiPaths['/doctors/me/availability']['put']['requestBody']
>['content']['application/json'];

type CreateTimeOffBody = NonNullable<
  ApiPaths['/doctors/me/availability/exceptions']['post']['requestBody']
>['content']['application/json'];

export function useAvailability() {
  return useQuery({
    queryKey: AVAILABILITY_QUERY_KEY,
    queryFn: async () => unwrap(await apiClient.GET('/doctors/me/availability')),
  });
}

export function useSaveAvailability() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: SaveAvailabilityBody) =>
      unwrap(await apiClient.PUT('/doctors/me/availability', { body })),
    onSuccess: (data) => {
      queryClient.setQueryData(AVAILABILITY_QUERY_KEY, data);
      // The saved schedule changes what any doctor-slots query returns
      // (including this doctor's own preview), so every such query is
      // invalidated rather than just this one's cache entry.
      void queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === 'doctors' && query.queryKey[2] === 'slots',
      });
    },
  });
}

export function useAddTimeOff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateTimeOffBody) =>
      unwrap(await apiClient.POST('/doctors/me/availability/exceptions', { body })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: AVAILABILITY_QUERY_KEY });
    },
  });
}

export function useDeleteTimeOff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      assertOk(
        await apiClient.DELETE('/doctors/me/availability/exceptions/{id}', {
          params: { path: { id } },
        }),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: AVAILABILITY_QUERY_KEY });
    },
  });
}

/** Slots for a doctor over `[from, to)` — used here for the schedule page's own preview. */
export function useDoctorSlots(doctorId: string | undefined, from: string, to: string) {
  return useQuery({
    queryKey: ['doctors', doctorId, 'slots', from, to] as const,
    queryFn: async () =>
      unwrap(
        await apiClient.GET('/doctors/{doctorId}/slots', {
          // Non-null assertion is safe: the query is `enabled` only once `doctorId` is set.
          params: { path: { doctorId: doctorId! }, query: { from, to } },
        }),
      ),
    enabled: doctorId !== undefined,
  });
}
