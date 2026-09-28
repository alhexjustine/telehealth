import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiPaths } from 'api-client';
import { apiClient } from '@/lib/api-client';
import { unwrap } from '@/lib/api-error';

export type AdminReviewListQuery = NonNullable<ApiPaths['/admin/reviews']['get']['parameters']['query']>;
type ModerateReviewBody = NonNullable<
  ApiPaths['/admin/reviews/{id}/hide']['post']['requestBody']
>['content']['application/json'];

const ADMIN_REVIEWS_KEY = ['admin', 'reviews'] as const;

export function useAdminReviews(query: AdminReviewListQuery) {
  return useQuery({
    queryKey: [...ADMIN_REVIEWS_KEY, 'list', query],
    queryFn: async () => unwrap(await apiClient.GET('/admin/reviews', { params: { query } })),
  });
}

export function useHideReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: ModerateReviewBody }) =>
      unwrap(await apiClient.POST('/admin/reviews/{id}/hide', { params: { path: { id } }, body })),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ADMIN_REVIEWS_KEY }),
  });
}

export function useUnhideReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: ModerateReviewBody }) =>
      unwrap(await apiClient.POST('/admin/reviews/{id}/unhide', { params: { path: { id } }, body })),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ADMIN_REVIEWS_KEY }),
  });
}
