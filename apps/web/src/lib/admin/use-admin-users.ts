import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiPaths } from 'api-client';
import { apiClient } from '@/lib/api-client';
import { unwrap } from '@/lib/api-error';

export type AdminUserListQuery = NonNullable<ApiPaths['/admin/users']['get']['parameters']['query']>;
type ChangeAccountStatusBody = NonNullable<
  ApiPaths['/admin/users/{id}/status']['post']['requestBody']
>['content']['application/json'];

const ADMIN_USERS_KEY = ['admin', 'users'] as const;

export function useAdminUsers(query: AdminUserListQuery) {
  return useQuery({
    queryKey: [...ADMIN_USERS_KEY, query],
    queryFn: async () => unwrap(await apiClient.GET('/admin/users', { params: { query } })),
  });
}

export function useChangeAccountStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: ChangeAccountStatusBody }) =>
      unwrap(await apiClient.POST('/admin/users/{id}/status', { params: { path: { id } }, body })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ADMIN_USERS_KEY });
    },
  });
}
