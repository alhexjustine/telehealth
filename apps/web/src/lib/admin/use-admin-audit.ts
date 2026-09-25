import { useQuery } from '@tanstack/react-query';
import type { ApiPaths } from 'api-client';
import { apiClient } from '@/lib/api-client';
import { unwrap } from '@/lib/api-error';

export type AdminAuditListQuery = NonNullable<ApiPaths['/admin/audit']['get']['parameters']['query']>;

export function useAdminAuditLog(query: AdminAuditListQuery) {
  return useQuery({
    queryKey: ['admin', 'audit', 'list', query] as const,
    queryFn: async () => unwrap(await apiClient.GET('/admin/audit', { params: { query } })),
  });
}

export function useAdminAuditEntry(id: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'audit', 'detail', id ?? ''] as const,
    queryFn: async () => unwrap(await apiClient.GET('/admin/audit/{id}', { params: { path: { id: id! } } })),
    enabled: id !== undefined,
  });
}
