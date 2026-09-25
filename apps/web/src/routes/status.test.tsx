import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusPage } from './status';
import { apiClient } from '@/lib/api-client';

vi.mock('@/lib/api-client', () => ({
  apiClient: { GET: vi.fn() },
}));

function renderStatusPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <StatusPage />
    </QueryClientProvider>,
  );
}

describe('StatusPage', () => {
  it('renders healthy state when the API reports the database as up', async () => {
    vi.mocked(apiClient.GET).mockResolvedValue({
      data: { status: 'ok', details: { database: { status: 'up' } } },
      error: undefined,
      response: new Response(null, { status: 200 }),
    } as never);

    renderStatusPage();

    await waitFor(() => expect(screen.getByTestId('api-status')).toHaveTextContent('Healthy'));
    expect(screen.getByTestId('database-status')).toHaveTextContent('Up');
  });

  it('renders unhealthy state when the API reports the database as down', async () => {
    vi.mocked(apiClient.GET).mockResolvedValue({
      data: undefined,
      error: { status: 'error', details: { database: { status: 'down' } } },
      response: new Response(null, { status: 503 }),
    } as never);

    renderStatusPage();

    await waitFor(() => expect(screen.getByTestId('api-status')).toHaveTextContent('Unhealthy'));
    expect(screen.getByTestId('database-status')).toHaveTextContent('Down');
  });
});
