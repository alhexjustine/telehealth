import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { unwrap } from '@/lib/api-error';

export function useRequestRefill(appointmentId: string, prescriptionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patientNote: string | undefined) =>
      unwrap(
        await apiClient.POST('/records/{appointmentId}/prescriptions/{prescriptionId}/refill-requests', {
          params: { path: { appointmentId, prescriptionId } },
          body: { patientNote },
        }),
      ),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['records', 'detail', appointmentId] }),
  });
}
