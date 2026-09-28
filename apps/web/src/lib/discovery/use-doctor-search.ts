import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { unwrap } from '@/lib/api-error';
import { availabilityRangeToQuery } from './availability-date';

export interface DoctorSearchParams {
  q?: string;
  specialization?: string;
  /** Inclusive local days, `yyyy-MM-dd`: only doctors with a free slot in that range. */
  availability?: { from: string; to: string };
  sort?: 'next' | 'name' | 'experience' | 'rating';
  page?: number;
}

const PAGE_SIZE = 12;

export function useDoctorSearch(params: DoctorSearchParams) {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const range = params.availability
    ? availabilityRangeToQuery(params.availability.from, params.availability.to, timezone, new Date())
    : undefined;

  return useQuery({
    queryKey: [
      'doctors',
      'search',
      params.q ?? '',
      params.specialization ?? '',
      params.availability?.from ?? '',
      params.availability?.to ?? '',
      params.sort ?? 'next',
      params.page ?? 1,
    ] as const,
    queryFn: async () =>
      unwrap(
        await apiClient.GET('/doctors', {
          params: {
            query: {
              q: params.q || undefined,
              specialization: params.specialization || undefined,
              availableFrom: range?.from,
              availableTo: range?.to,
              sort: params.sort ?? 'next',
              page: params.page ?? 1,
              pageSize: PAGE_SIZE,
            },
          },
        }),
      ),
  });
}

export function usePublicDoctorProfile(doctorId: string | undefined) {
  return useQuery({
    queryKey: ['doctors', doctorId, 'public-profile'] as const,
    queryFn: async () =>
      unwrap(
        await apiClient.GET('/doctors/{doctorId}', {
          // Non-null assertion is safe: the query is `enabled` only once `doctorId` is set.
          params: { path: { doctorId: doctorId! } },
        }),
      ),
    enabled: doctorId !== undefined,
  });
}
