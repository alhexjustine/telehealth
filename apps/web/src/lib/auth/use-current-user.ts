import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { CurrentUser } from './types';

export const CURRENT_USER_QUERY_KEY = ['auth', 'me'] as const;

async function fetchCurrentUser(): Promise<CurrentUser | null> {
  const result = await apiClient.GET('/auth/me');
  if (result.response.status === 401) {
    return null;
  }
  if (!result.response.ok || !result.data) {
    throw new Error(`Failed to load the current user (status ${result.response.status})`);
  }
  return result.data;
}

/** The single source of truth for "who is signed in", cached by TanStack Query. */
export function useCurrentUser() {
  return useQuery({
    queryKey: CURRENT_USER_QUERY_KEY,
    queryFn: fetchCurrentUser,
    retry: false,
    staleTime: 60_000,
  });
}
