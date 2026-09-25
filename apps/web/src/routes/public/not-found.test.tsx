import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { NotFoundPage } from './not-found';
import { useCurrentUser } from '@/lib/auth/use-current-user';

vi.mock('@/lib/auth/use-current-user', () => ({ useCurrentUser: vi.fn() }));

function renderAt(path: string) {
  const queryClient = new QueryClient();
  const router = createMemoryRouter(
    [
      { path: '/', element: <div>Landing content</div> },
      { path: '*', element: <NotFoundPage /> },
    ],
    { initialEntries: [path] },
  );
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('NotFoundPage', () => {
  it('Unknown route', () => {
    vi.mocked(useCurrentUser).mockReturnValue({ data: null, isPending: false } as never);

    renderAt('/no-such-page');

    expect(screen.getByText(/page not found/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to the landing page/i })).toHaveAttribute(
      'href',
      '/',
    );
  });

  it('offers the role home link for a signed-in user', () => {
    vi.mocked(useCurrentUser).mockReturnValue({
      data: { id: '1', email: 'p@example.com', role: 'PATIENT', status: 'ACTIVE', displayName: 'P' },
      isPending: false,
    } as never);

    renderAt('/no-such-page');

    expect(screen.getByRole('link', { name: /go to my dashboard/i })).toHaveAttribute(
      'href',
      '/patient',
    );
  });
});
