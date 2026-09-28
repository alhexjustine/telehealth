import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiPaths } from 'api-client';
import { apiClient } from '@/lib/api-client';
import { assertOk, unwrap } from '@/lib/api-error';

export type FavoriteDoctorDto =
  ApiPaths['/patients/me/favorites']['get']['responses'][200]['content']['application/json']['items'][number];

export const FAVORITES_KEY = ['favorites'] as const;

export function useFavorites() {
  return useQuery({
    queryKey: FAVORITES_KEY,
    queryFn: async () => unwrap(await apiClient.GET('/patients/me/favorites')),
  });
}

export function useFavoriteDoctor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (doctorId: string) =>
      unwrap(await apiClient.POST('/patients/me/favorites', { body: { doctorId } })),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: FAVORITES_KEY }),
  });
}

export function useUnfavoriteDoctor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (doctorId: string) =>
      assertOk(await apiClient.DELETE('/patients/me/favorites/{doctorId}', { params: { path: { doctorId } } })),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: FAVORITES_KEY }),
  });
}
