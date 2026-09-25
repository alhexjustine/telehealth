import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { unwrap } from '@/lib/api-error';

const DEFAULT_PAGE_SIZE = 20;

export function usePatientRecords(page = 1, pageSize = DEFAULT_PAGE_SIZE) {
  return useQuery({
    queryKey: ['records', 'list', page, pageSize] as const,
    queryFn: async () => unwrap(await apiClient.GET('/records', { params: { query: { page, pageSize } } })),
  });
}

export function usePatientRecord(appointmentId: string | undefined) {
  return useQuery({
    queryKey: ['records', 'detail', appointmentId ?? ''] as const,
    queryFn: async () =>
      unwrap(await apiClient.GET('/records/{appointmentId}', { params: { path: { appointmentId: appointmentId! } } })),
    enabled: appointmentId !== undefined,
  });
}

export function useDoctorPatientRecord(patientId: string | undefined) {
  return useQuery({
    queryKey: ['records', 'patient', patientId ?? ''] as const,
    queryFn: async () =>
      unwrap(await apiClient.GET('/patients/{patientId}/record', { params: { path: { patientId: patientId! } } })),
    enabled: patientId !== undefined,
  });
}
