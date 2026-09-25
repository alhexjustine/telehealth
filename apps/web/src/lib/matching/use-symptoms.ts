import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { unwrap } from '@/lib/api-error';

export function useSymptomCatalog() {
  return useQuery({
    queryKey: ['symptoms'],
    queryFn: async () => unwrap(await apiClient.GET('/symptoms')),
    staleTime: 5 * 60_000,
  });
}
