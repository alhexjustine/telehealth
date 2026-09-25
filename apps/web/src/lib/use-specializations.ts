import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { unwrap } from '@/lib/api-error';

export function useSpecializations() {
  return useQuery({
    queryKey: ['specializations'],
    queryFn: async () => unwrap(await apiClient.GET('/specializations')),
    staleTime: 5 * 60_000,
  });
}
