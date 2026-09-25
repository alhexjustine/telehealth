import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiPaths } from 'api-client';
import { apiClient } from '@/lib/api-client';
import { unwrap } from '@/lib/api-error';

type SaveNoteBody = NonNullable<
  ApiPaths['/consultations/{appointmentId}/note']['put']['requestBody']
>['content']['application/json'];

type CreatePrescriptionBody = NonNullable<
  ApiPaths['/consultations/{appointmentId}/prescriptions']['post']['requestBody']
>['content']['application/json'];

type UpdatePrescriptionBody = NonNullable<
  ApiPaths['/consultations/{appointmentId}/prescriptions/{prescriptionId}']['patch']['requestBody']
>['content']['application/json'];

function workspaceKey(appointmentId: string) {
  return ['consultations', 'workspace', appointmentId] as const;
}

export function useConsultationWorkspace(appointmentId: string | undefined) {
  return useQuery({
    queryKey: workspaceKey(appointmentId ?? ''),
    queryFn: async () =>
      unwrap(await apiClient.GET('/consultations/{appointmentId}', { params: { path: { appointmentId: appointmentId! } } })),
    enabled: appointmentId !== undefined,
  });
}

function invalidateWorkspace(queryClient: ReturnType<typeof useQueryClient>, appointmentId: string) {
  void queryClient.invalidateQueries({ queryKey: workspaceKey(appointmentId) });
}

export function useJoinConsultation(appointmentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      unwrap(await apiClient.POST('/consultations/{appointmentId}/join', { params: { path: { appointmentId } } })),
    onSuccess: () => invalidateWorkspace(queryClient, appointmentId),
  });
}

export function useStartConsultation(appointmentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      unwrap(await apiClient.POST('/consultations/{appointmentId}/start', { params: { path: { appointmentId } } })),
    onSuccess: () => invalidateWorkspace(queryClient, appointmentId),
  });
}

export function useCompleteConsultation(appointmentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      unwrap(await apiClient.POST('/consultations/{appointmentId}/complete', { params: { path: { appointmentId } } })),
    onSuccess: () => invalidateWorkspace(queryClient, appointmentId),
  });
}

export function useSaveConsultationNote(appointmentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: SaveNoteBody) =>
      unwrap(
        await apiClient.PUT('/consultations/{appointmentId}/note', { params: { path: { appointmentId } }, body }),
      ),
    onSuccess: () => invalidateWorkspace(queryClient, appointmentId),
  });
}

export function useAddPrescription(appointmentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreatePrescriptionBody) =>
      unwrap(
        await apiClient.POST('/consultations/{appointmentId}/prescriptions', {
          params: { path: { appointmentId } },
          body,
        }),
      ),
    onSuccess: () => invalidateWorkspace(queryClient, appointmentId),
  });
}

export function useUpdatePrescription(appointmentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ prescriptionId, body }: { prescriptionId: string; body: UpdatePrescriptionBody }) =>
      unwrap(
        await apiClient.PATCH('/consultations/{appointmentId}/prescriptions/{prescriptionId}', {
          params: { path: { appointmentId, prescriptionId } },
          body,
        }),
      ),
    onSuccess: () => invalidateWorkspace(queryClient, appointmentId),
  });
}

export function useDeletePrescription(appointmentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (prescriptionId: string) => {
      const result = await apiClient.DELETE('/consultations/{appointmentId}/prescriptions/{prescriptionId}', {
        params: { path: { appointmentId, prescriptionId } },
      });
      if (!result.response.ok) {
        throw new Error('Could not remove the prescription');
      }
    },
    onSuccess: () => invalidateWorkspace(queryClient, appointmentId),
  });
}
