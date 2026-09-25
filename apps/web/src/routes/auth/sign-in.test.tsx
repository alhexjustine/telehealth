import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { SignInPage } from './sign-in';
import { useLoginMutation } from '@/lib/auth/mutations';

vi.mock('@/lib/auth/mutations', () => ({ useLoginMutation: vi.fn() }));

function renderSignIn(initialPath = '/login') {
  const queryClient = new QueryClient();
  const router = createMemoryRouter(
    [
      { path: '/login', element: <SignInPage /> },
      { path: '/patient', element: <div>Patient home</div> },
      { path: '/doctor', element: <div>Doctor home</div> },
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

describe('SignInPage', () => {
  it('shows inline validation errors and does not submit', async () => {
    const mutateAsync = vi.fn();
    vi.mocked(useLoginMutation).mockReturnValue({
      mutateAsync,
      isPending: false,
      isError: false,
    } as never);

    renderSignIn();
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/email is required/i)).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('Sign-in lands in the role area', async () => {
    const mutateAsync = vi
      .fn()
      .mockResolvedValue({ id: '1', email: 'p@example.com', role: 'PATIENT' });
    vi.mocked(useLoginMutation).mockReturnValue({
      mutateAsync,
      isPending: false,
      isError: false,
    } as never);

    const router = renderSignIn();
    await userEvent.type(screen.getByLabelText(/email/i), 'p@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'correct-horse-battery');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/patient'));
  });

  it('Unsafe return address', async () => {
    const mutateAsync = vi
      .fn()
      .mockResolvedValue({ id: '1', email: 'p@example.com', role: 'PATIENT' });
    vi.mocked(useLoginMutation).mockReturnValue({
      mutateAsync,
      isPending: false,
      isError: false,
    } as never);

    const router = renderSignIn('/login?returnTo=https%3A%2F%2Fevil.example');
    await userEvent.type(screen.getByLabelText(/email/i), 'p@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'correct-horse-battery');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    // Lands on the role home page, never on the off-site address.
    await waitFor(() => expect(router.state.location.pathname).toBe('/patient'));
  });
});
