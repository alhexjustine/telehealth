import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { unwrap } from '@/lib/api-error';

export function useAdminDashboard() {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return useQuery({
    queryKey: ['admin', 'dashboard', tz] as const,
    queryFn: async () => unwrap(await apiClient.GET('/admin/dashboard', { params: { query: { tz } } })),
  });
}
