import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { PublicLayout } from './public-layout';
import { useCurrentUser } from '@/lib/auth/use-current-user';

vi.mock('@/lib/auth/use-current-user', () => ({ useCurrentUser: vi.fn() }));

function renderLayout(initialPath = '/') {
  const queryClient = new QueryClient();
  const router = createMemoryRouter(
    [
      {
        element: <PublicLayout />,
        children: [{ path: '/', element: <div>Landing content</div> }],
      },
    ],
    { initialEntries: [initialPath] },
  );
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

describe('PublicLayout', () => {
  it('Header links for visitors', () => {
    vi.mocked(useCurrentUser).mockReturnValue({ data: null, isPending: false } as never);

    renderLayout();
    const header = within(screen.getByRole('banner'));

    expect(header.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/login');
    expect(header.getByRole('link', { name: /register as a patient/i })).toHaveAttribute(
      'href',
      '/register/patient',
    );
    expect(header.getByRole('link', { name: /join as a doctor/i })).toHaveAttribute(
      'href',
      '/register/doctor',
    );
  });

  it('Header for a signed-in user', () => {
    vi.mocked(useCurrentUser).mockReturnValue({
      data: { id: '1', email: 'doc@example.com', role: 'DOCTOR', status: 'ACTIVE', displayName: 'Doc' },
      isPending: false,
    } as never);

    renderLayout();
    const header = within(screen.getByRole('banner'));

    expect(header.getByRole('link', { name: /go to my dashboard/i })).toHaveAttribute(
      'href',
      '/doctor',
    );
    expect(header.queryByRole('link', { name: /^sign in$/i })).not.toBeInTheDocument();
  });

  it('Mobile menu', async () => {
    vi.mocked(useCurrentUser).mockReturnValue({ data: null, isPending: false } as never);
    const user = userEvent.setup();

    renderLayout();
    const trigger = screen.getByRole('button', { name: /open menu/i });

    await user.click(trigger);
    const dialog = await screen.findByRole('dialog');
    const signInLink = within(dialog).getByRole('link', { name: /sign in/i });
    expect(signInLink).toBeInTheDocument();

    // Tab reaches the links inside the menu.
    await user.tab();
    expect(document.activeElement).not.toBe(document.body);

    // Escape closes the menu and returns focus to the trigger.
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
