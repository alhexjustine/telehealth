import { useQuery } from '@tanstack/react-query';
import type { ApiPaths } from 'api-client';
import { apiClient } from '@/lib/api-client';
import { unwrap } from '@/lib/api-error';

export type RecordPrescriptionDto =
  ApiPaths['/records/{appointmentId}']['get']['responses'][200]['content']['application/json']['prescriptions'][number];

const DEFAULT_PAGE_SIZE = 20;

export function usePatientRecords(page = 1, pageSize = DEFAULT_PAGE_SIZE, dependentId?: string) {
  return useQuery({
    queryKey: ['records', 'list', page, pageSize, dependentId ?? ''] as const,
    queryFn: async () =>
      unwrap(await apiClient.GET('/records', { params: { query: { page, pageSize, dependentId } } })),
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

export function useDoctorPatientRecord(patientId: string | undefined, dependentId?: string) {
  return useQuery({
    queryKey: ['records', 'patient', patientId ?? '', dependentId ?? ''] as const,
    queryFn: async () =>
      unwrap(
        await apiClient.GET('/patients/{patientId}/record', {
          params: { path: { patientId: patientId! }, query: { dependentId } },
        }),
      ),
    enabled: patientId !== undefined,
  });
}
