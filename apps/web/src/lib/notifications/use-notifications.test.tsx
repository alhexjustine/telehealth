import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useNotifications } from './use-notifications';
import { apiClient } from '@/lib/api-client';

vi.mock('@/lib/api-client', () => ({
  apiClient: { GET: vi.fn(), POST: vi.fn() },
}));

const ok = <T,>(data: T) => ({ data, error: undefined, response: { ok: true, status: 200 } as Response });

function wrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useNotifications', () => {
  it("a small pageSize query (the bell) doesn't poison a larger pageSize query (the full list) sharing the same page/unreadOnly", async () => {
    vi.mocked(apiClient.GET).mockImplementation(((_path: unknown, options: { params: { query: { pageSize: number } } }) => {
      const { pageSize } = options.params.query;
      const items = Array.from({ length: pageSize }, (_, i) => ({
        id: `n${i}`,
        type: 'BOOKING_CONFIRMED',
        title: `Notification ${i}`,
        body: '',
        data: null,
        link: null,
        appointmentId: null,
        readAt: null,
        createdAt: new Date().toISOString(),
      }));
      return ok({ items, total: 23, page: 1, pageSize });
    }) as never);

    const queryClient = new QueryClient();
    const Wrapper = wrapper(queryClient);

    // The bell's query (small page size) fetches first and settles.
    const bell = renderHook(() => useNotifications(false, 1, 5), { wrapper: Wrapper });
    await waitFor(() => expect(bell.result.current.data?.items).toHaveLength(5));

    // The full notifications page's query (larger page size), same page/unreadOnly.
    const full = renderHook(() => useNotifications(false, 1, 20), { wrapper: Wrapper });
    await waitFor(() => expect(full.result.current.data?.items).toHaveLength(20));

    // The bell's own query must be unaffected.
    expect(bell.result.current.data?.items).toHaveLength(5);
  });
});
