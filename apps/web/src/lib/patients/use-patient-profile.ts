import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiPaths } from 'api-client';
import { apiClient } from '@/lib/api-client';
import { unwrap } from '@/lib/api-error';

export const PATIENT_PROFILE_QUERY_KEY = ['patients', 'me', 'profile'] as const;

type UpdatePatientProfileBody = NonNullable<
  ApiPaths['/patients/me/profile']['patch']['requestBody']
>['content']['application/json'];

export function usePatientProfile() {
  return useQuery({
    queryKey: PATIENT_PROFILE_QUERY_KEY,
    queryFn: async () => unwrap(await apiClient.GET('/patients/me/profile')),
  });
}

export function useUpdatePatientProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdatePatientProfileBody) =>
      unwrap(await apiClient.PATCH('/patients/me/profile', { body })),
    onSuccess: (data) => {
      queryClient.setQueryData(PATIENT_PROFILE_QUERY_KEY, data);
      void queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });
}
