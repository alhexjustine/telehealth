import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
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

    expect(header.getByRole('link', { name: 'Hey Doc' })).toHaveAttribute('href', '/');
    expect(header.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/login');
    expect(header.queryByRole('link', { name: /register as a patient/i })).not.toBeInTheDocument();
    expect(header.queryByRole('link', { name: /join as a doctor/i })).not.toBeInTheDocument();
  });

  it('Registration links in the footer', () => {
    vi.mocked(useCurrentUser).mockReturnValue({ data: null, isPending: false } as never);

    renderLayout();
    const footer = within(screen.getByRole('contentinfo'));

    expect(footer.getByRole('link', { name: /register as a patient/i })).toHaveAttribute(
      'href',
      '/register/patient',
    );
    expect(footer.getByRole('link', { name: /join as a doctor/i })).toHaveAttribute(
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

  // The header never collapses: no menu button, and its links are reached directly with Tab. The
  // 375px no-horizontal-scroll half of the scenario is covered by e2e/tests/responsive.spec.ts.
  it('Mobile menu', async () => {
    vi.mocked(useCurrentUser).mockReturnValue({ data: null, isPending: false } as never);
    const user = userEvent.setup();

    renderLayout();
    expect(screen.queryByRole('button', { name: /open menu/i })).not.toBeInTheDocument();

    await user.tab();
    expect(screen.getByRole('link', { name: /skip to content/i })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('link', { name: 'Hey Doc' })).toHaveFocus();
    await user.tab();
    expect(within(screen.getByRole('banner')).getByRole('link', { name: /sign in/i })).toHaveFocus();
  });
});
