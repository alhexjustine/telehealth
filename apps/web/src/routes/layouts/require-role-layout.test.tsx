import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { RequireRoleLayout } from './require-role-layout';
import { useCurrentUser } from '@/lib/auth/use-current-user';

vi.mock('@/lib/auth/use-current-user', () => ({ useCurrentUser: vi.fn() }));

function renderAt(path: string) {
  const queryClient = new QueryClient();
  const router = createMemoryRouter(
    [
      {
        path: '/patient',
        element: <RequireRoleLayout role="PATIENT" />,
        children: [{ index: true, element: <div>Patient home</div> }],
      },
      { path: '/login', element: <div>Sign in page</div> },
    ],
    { initialEntries: [path] },
  );
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

describe('RequireRoleLayout', () => {
  it('Signed-out user opens a protected page', () => {
    vi.mocked(useCurrentUser).mockReturnValue({ data: null, isPending: false } as never);

    const router = renderAt('/patient');

    expect(screen.getByText('Sign in page')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toBe('?returnTo=%2Fpatient');
  });

  it('Wrong role area', () => {
    vi.mocked(useCurrentUser).mockReturnValue({
      data: {
        id: '1',
        email: 'doc@example.com',
        role: 'DOCTOR',
        status: 'ACTIVE',
        displayName: 'Doc',
      },
      isPending: false,
    } as never);

    const router = createMemoryRouter(
      [
        {
          path: '/patient',
          element: <RequireRoleLayout role="PATIENT" />,
          children: [{ index: true, element: <div>Patient home</div> }],
        },
        { path: '/doctor', element: <div>Doctor home</div> },
      ],
      { initialEntries: ['/patient'] },
    );
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    expect(screen.getByText('Doctor home')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/doctor');
  });

  it('renders the protected content for a signed-in user with the right role', () => {
    vi.mocked(useCurrentUser).mockReturnValue({
      data: {
        id: '1',
        email: 'pat@example.com',
        role: 'PATIENT',
        status: 'ACTIVE',
        displayName: 'Pat',
      },
      isPending: false,
    } as never);

    renderAt('/patient');

    expect(screen.getByText('Patient home')).toBeInTheDocument();
  });
});
