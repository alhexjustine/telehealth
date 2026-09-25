import { useMutation } from '@tanstack/react-query';
import type { ApiPaths } from 'api-client';
import { apiClient } from '@/lib/api-client';
import { unwrap } from '@/lib/api-error';

type MatchingRequestBody = NonNullable<
  ApiPaths['/matching']['post']['requestBody']
>['content']['application/json'];

export function useMatching() {
  return useMutation({
    mutationFn: async (body: MatchingRequestBody) => unwrap(await apiClient.POST('/matching', { body })),
  });
}
