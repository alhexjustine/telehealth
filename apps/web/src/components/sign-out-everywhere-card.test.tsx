import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { SignOutEverywhereCard } from './sign-out-everywhere-card';
import { useLogoutAllMutation } from '@/lib/auth/mutations';

vi.mock('@/lib/auth/mutations', () => ({ useLogoutAllMutation: vi.fn() }));

describe('SignOutEverywhereCard', () => {
  it('signs out of all devices and returns to sign-in', async () => {
    const mutateAsync = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useLogoutAllMutation).mockReturnValue({ mutateAsync, isPending: false } as never);
    const router = createMemoryRouter(
      [
        { path: '/patient/profile', element: <SignOutEverywhereCard /> },
        { path: '/login', element: <p>Sign-in page</p> },
      ],
      { initialEntries: ['/patient/profile'] },
    );
    render(<RouterProvider router={router} />);

    await userEvent.click(screen.getByRole('button', { name: 'Sign out of all devices' }));

    expect(mutateAsync).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
  });
});
