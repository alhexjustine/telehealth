import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiPaths } from 'api-client';
import { apiClient } from '@/lib/api-client';
import { unwrap } from '@/lib/api-error';

export type AdminDoctorListQuery = NonNullable<ApiPaths['/admin/doctors']['get']['parameters']['query']>;
type ApproveDoctorBody = NonNullable<ApiPaths['/admin/doctors/{id}/approve']['post']['requestBody']>['content']['application/json'];
type RejectDoctorBody = NonNullable<ApiPaths['/admin/doctors/{id}/reject']['post']['requestBody']>['content']['application/json'];
type UpdateAdminDoctorBody = NonNullable<ApiPaths['/admin/doctors/{id}']['patch']['requestBody']>['content']['application/json'];

const ADMIN_DOCTORS_KEY = ['admin', 'doctors'] as const;

function doctorDetailKey(id: string) {
  return ['admin', 'doctors', 'detail', id] as const;
}

export function useAdminDoctors(query: AdminDoctorListQuery) {
  return useQuery({
    queryKey: [...ADMIN_DOCTORS_KEY, 'list', query],
    queryFn: async () => unwrap(await apiClient.GET('/admin/doctors', { params: { query } })),
  });
}

export function useAdminDoctor(id: string | undefined) {
  return useQuery({
    queryKey: doctorDetailKey(id ?? ''),
    queryFn: async () => unwrap(await apiClient.GET('/admin/doctors/{id}', { params: { path: { id: id! } } })),
    enabled: id !== undefined,
  });
}

export function useApproveDoctor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: ApproveDoctorBody }) =>
      unwrap(await apiClient.POST('/admin/doctors/{id}/approve', { params: { path: { id } }, body })),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ADMIN_DOCTORS_KEY });
      void queryClient.invalidateQueries({ queryKey: doctorDetailKey(variables.id) });
    },
  });
}

export function useRejectDoctor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: RejectDoctorBody }) =>
      unwrap(await apiClient.POST('/admin/doctors/{id}/reject', { params: { path: { id } }, body })),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ADMIN_DOCTORS_KEY });
      void queryClient.invalidateQueries({ queryKey: doctorDetailKey(variables.id) });
    },
  });
}

export function useUpdateAdminDoctorProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: UpdateAdminDoctorBody }) =>
      unwrap(await apiClient.PATCH('/admin/doctors/{id}', { params: { path: { id } }, body })),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ADMIN_DOCTORS_KEY });
      void queryClient.invalidateQueries({ queryKey: doctorDetailKey(variables.id) });
    },
  });
}
