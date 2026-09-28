import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiPaths } from 'api-client';
import { apiClient } from '@/lib/api-client';
import { unwrap } from '@/lib/api-error';

export type DependentDto =
  ApiPaths['/patients/me/dependents']['get']['responses'][200]['content']['application/json']['items'][number];

type CreateDependentBody = NonNullable<
  ApiPaths['/patients/me/dependents']['post']['requestBody']
>['content']['application/json'];

type UpdateDependentBody = NonNullable<
  ApiPaths['/patients/me/dependents/{id}']['patch']['requestBody']
>['content']['application/json'];

export const DEPENDENTS_KEY = ['dependents'] as const;

export function useDependents() {
  return useQuery({
    queryKey: DEPENDENTS_KEY,
    queryFn: async () => unwrap(await apiClient.GET('/patients/me/dependents')),
  });
}

export function useAddDependent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateDependentBody) => unwrap(await apiClient.POST('/patients/me/dependents', { body })),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: DEPENDENTS_KEY }),
  });
}

export function useUpdateDependent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: UpdateDependentBody }) =>
      unwrap(await apiClient.PATCH('/patients/me/dependents/{id}', { params: { path: { id } }, body })),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: DEPENDENTS_KEY }),
  });
}

export function useRemoveDependent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await apiClient.DELETE('/patients/me/dependents/{id}', { params: { path: { id } } })),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: DEPENDENTS_KEY }),
  });
}
