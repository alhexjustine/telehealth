import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiPaths } from 'api-client';
import { apiClient } from '@/lib/api-client';
import { unwrap } from '@/lib/api-error';

export const DOCTOR_PROFILE_QUERY_KEY = ['doctors', 'me', 'profile'] as const;

type UpdateDoctorProfileBody = NonNullable<
  ApiPaths['/doctors/me/profile']['patch']['requestBody']
>['content']['application/json'];

export function useDoctorProfile() {
  return useQuery({
    queryKey: DOCTOR_PROFILE_QUERY_KEY,
    queryFn: async () => unwrap(await apiClient.GET('/doctors/me/profile')),
  });
}

export function useUpdateDoctorProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdateDoctorProfileBody) =>
      unwrap(await apiClient.PATCH('/doctors/me/profile', { body })),
    onSuccess: (data) => {
      queryClient.setQueryData(DOCTOR_PROFILE_QUERY_KEY, data);
      void queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });
}
