import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ApiPaths } from 'api-client';
import { apiClient } from '@/lib/api-client';
import { assertOk, unwrap } from '@/lib/api-error';
import { CURRENT_USER_QUERY_KEY } from './use-current-user';

type RegisterPatientBody = NonNullable<
  ApiPaths['/auth/register/patient']['post']['requestBody']
>['content']['application/json'];
type RegisterDoctorBody = NonNullable<
  ApiPaths['/auth/register/doctor']['post']['requestBody']
>['content']['application/json'];
type LoginBody = NonNullable<
  ApiPaths['/auth/login']['post']['requestBody']
>['content']['application/json'];
type ChangePasswordBody = NonNullable<
  ApiPaths['/auth/password']['post']['requestBody']
>['content']['application/json'];

export function useLoginMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: LoginBody) => unwrap(await apiClient.POST('/auth/login', { body })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CURRENT_USER_QUERY_KEY }),
  });
}

export function useRegisterPatientMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: RegisterPatientBody) =>
      unwrap(await apiClient.POST('/auth/register/patient', { body })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CURRENT_USER_QUERY_KEY }),
  });
}

export function useRegisterDoctorMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: RegisterDoctorBody) =>
      unwrap(await apiClient.POST('/auth/register/doctor', { body })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CURRENT_USER_QUERY_KEY }),
  });
}

export function useLogoutMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => assertOk(await apiClient.POST('/auth/logout')),
    onSuccess: () => {
      queryClient.setQueryData(CURRENT_USER_QUERY_KEY, null);
      queryClient.clear();
    },
  });
}

export function useLogoutAllMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => assertOk(await apiClient.POST('/auth/logout-all')),
    onSuccess: () => {
      queryClient.setQueryData(CURRENT_USER_QUERY_KEY, null);
      queryClient.clear();
    },
  });
}

export function useChangePasswordMutation() {
  return useMutation({
    mutationFn: async (body: ChangePasswordBody) =>
      assertOk(await apiClient.POST('/auth/password', { body })),
  });
}
