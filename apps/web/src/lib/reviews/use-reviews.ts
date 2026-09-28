import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiPaths } from 'api-client';
import { apiClient } from '@/lib/api-client';
import { unwrap } from '@/lib/api-error';

export type OwnReviewDto =
  ApiPaths['/appointments/{appointmentId}/review']['get']['responses'][200]['content']['application/json'];

type SubmitReviewBody = NonNullable<
  ApiPaths['/appointments/{appointmentId}/review']['put']['requestBody']
>['content']['application/json'];

export type DoctorReviewListDto =
  ApiPaths['/doctors/{doctorId}/reviews']['get']['responses'][200]['content']['application/json'];

function ownReviewKey(appointmentId: string) {
  return ['appointments', appointmentId, 'review'] as const;
}

/** The caller's own review of this appointment, or `null` if they haven't left one yet. */
export function useOwnReview(appointmentId: string | undefined) {
  return useQuery({
    queryKey: ownReviewKey(appointmentId ?? ''),
    queryFn: async () => {
      const result = await apiClient.GET('/appointments/{appointmentId}/review', {
        // Non-null assertion is safe: the query is `enabled` only once `appointmentId` is set.
        params: { path: { appointmentId: appointmentId! } },
      });
      if (result.response.status === 404) return null;
      return unwrap(result);
    },
    enabled: appointmentId !== undefined,
  });
}

export function useSubmitReview(appointmentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: SubmitReviewBody) =>
      unwrap(
        await apiClient.PUT('/appointments/{appointmentId}/review', {
          params: { path: { appointmentId } },
          body,
        }),
      ),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ownReviewKey(appointmentId) }),
  });
}

export function useDoctorReviews(doctorId: string | undefined, page = 1) {
  return useQuery({
    queryKey: ['doctors', doctorId ?? '', 'reviews', page] as const,
    queryFn: async () =>
      unwrap(
        await apiClient.GET('/doctors/{doctorId}/reviews', {
          // Non-null assertion is safe: the query is `enabled` only once `doctorId` is set.
          params: { path: { doctorId: doctorId! }, query: { page } },
        }),
      ),
    enabled: doctorId !== undefined,
  });
}
