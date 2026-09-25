import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { RecoveryPage } from './recovery-page';
import { useCurrentUser } from '@/lib/auth/use-current-user';

vi.mock('@/lib/auth/use-current-user', () => ({ useCurrentUser: vi.fn() }));

function ThrowingComponent(): never {
  throw new Error('boom');
}

function renderApp() {
  const queryClient = new QueryClient();
  const router = createMemoryRouter(
    [
      {
        element: <div id="app-shell">{/* stands in for the persistent app chrome */}</div>,
      },
      {
        path: '/patient',
        errorElement: <RecoveryPage />,
        children: [{ index: true, element: <ThrowingComponent /> }],
      },
      { path: '/', element: <div>Landing page</div> },
    ],
    { initialEntries: ['/patient'] },
  );
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

describe('RecoveryPage', () => {
  it('Component crashes', async () => {
    const user = userEvent.setup();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(useCurrentUser).mockReturnValue({ data: null, isPending: false } as never);

    const router = renderApp();

    expect(screen.getByRole('heading', { name: /something went wrong/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument();
    const homeLink = screen.getByRole('link', { name: /go home/i });
    expect(homeLink).toHaveAttribute('href', '/');
    expect(consoleError).toHaveBeenCalled();

    // The rest of the app remains usable after navigating away from the crash.
    await user.click(homeLink);
    expect(screen.getByText('Landing page')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');

    consoleError.mockRestore();
  });

  it('resolves the home link from the signed-in user role', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(useCurrentUser).mockReturnValue({
      data: { id: '1', email: 'doc@example.com', role: 'DOCTOR', status: 'ACTIVE', displayName: 'Doc' },
      isPending: false,
    } as never);

    renderApp();

    expect(screen.getByRole('link', { name: /go home/i })).toHaveAttribute('href', '/doctor');
  });
});
