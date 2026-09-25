import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { QueryState } from './query-state';
import { ApiError } from '@/lib/api-error';

interface Item {
  id: string;
}

function Harness({ queryFn, label = 'appointments' }: { queryFn: () => Promise<{ items: Item[] }>; label?: string }) {
  const query = useQuery({ queryKey: ['harness'], queryFn, retry: false });
  return (
    <QueryState
      query={query}
      label={label}
      isEmpty={(data) => data.items.length === 0}
      empty={<p>No {label} yet. Visit Find care to book one.</p>}
    >
      {(data) => (
        <ul>
          {data.items.map((item) => (
            <li key={item.id}>{item.id}</li>
          ))}
        </ul>
      )}
    </QueryState>
  );
}

function renderHarness(queryFn: () => Promise<{ items: Item[] }>) {
  const queryClient = new QueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <Harness queryFn={queryFn} />
    </QueryClientProvider>,
  );
  return queryClient;
}

describe('QueryState', () => {
  it('shows a loading state while the first request is pending', () => {
    renderHarness(() => new Promise(() => {}));
    expect(screen.getByRole('status')).toHaveTextContent(/loading appointments/i);
  });

  it('Request fails', async () => {
    const user = userEvent.setup();
    const queryFn = vi
      .fn<() => Promise<{ items: Item[] }>>()
      .mockRejectedValueOnce(new ApiError('The server had a problem handling that.', 500))
      .mockResolvedValueOnce({ items: [{ id: 'apt-1' }] });

    renderHarness(queryFn);

    await waitFor(() => expect(screen.getByText(/the server had a problem/i)).toBeInTheDocument());
    const retry = screen.getByRole('button', { name: /try again/i });

    await user.click(retry);

    await waitFor(() => expect(screen.getByText('apt-1')).toBeInTheDocument());
    expect(queryFn).toHaveBeenCalledTimes(2);
  });

  it('Background refresh fails', async () => {
    const queryFn = vi
      .fn<() => Promise<{ items: Item[] }>>()
      .mockResolvedValueOnce({ items: [{ id: 'apt-1' }] })
      .mockRejectedValueOnce(new ApiError('The server had a problem handling that.', 500));

    const queryClient = renderHarness(queryFn);

    await waitFor(() => expect(screen.getByText('apt-1')).toBeInTheDocument());

    await queryClient.refetchQueries({ queryKey: ['harness'] }).catch(() => {});

    await waitFor(() =>
      expect(screen.getByText(/couldn't refresh appointments just now/i)).toBeInTheDocument(),
    );
    // The stale data stays on screen instead of being replaced by the error view.
    expect(screen.getByText('apt-1')).toBeInTheDocument();
  });

  it('Empty list', async () => {
    renderHarness(() => Promise.resolve({ items: [] }));

    await waitFor(() =>
      expect(screen.getByText(/no appointments yet\. visit find care/i)).toBeInTheDocument(),
    );
  });
});
