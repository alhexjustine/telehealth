import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { RoleAreaLayout, type RoleNavItem } from './role-area-layout';
import { useCurrentUser } from '@/lib/auth/use-current-user';

vi.mock('@/lib/auth/use-current-user', () => ({ useCurrentUser: vi.fn() }));
vi.mock('@/lib/auth/mutations', () => ({
  useLogoutMutation: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock('@/lib/realtime/realtime-provider', () => ({
  RealtimeProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('@/components/notification-bell', () => ({ NotificationBell: () => null }));

const PATIENT_NAV: RoleNavItem[] = [
  { to: '/patient', label: 'Home' },
  { to: '/patient/doctors', label: 'Find a doctor' },
  { to: '/patient/find-care', label: 'Find care' },
];

function renderAt(path: string) {
  vi.mocked(useCurrentUser).mockReturnValue({
    data: { id: '1', email: 'p@example.com', role: 'PATIENT', status: 'ACTIVE', displayName: 'Ada Lovelace' },
  } as never);
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<RoleAreaLayout navItems={PATIENT_NAV} profilePath="/patient/profile" />}>
          <Route path="/patient" element={<p>Home page</p>} />
          <Route path="/patient/doctors/:doctorId" element={<p>Doctor page</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
  return within(screen.getByRole('navigation', { name: 'Main' }));
}

describe('RoleAreaLayout', () => {
  it('marks the section of a nested page as the current nav item', () => {
    const nav = renderAt('/patient/doctors/abc');

    expect(nav.getByRole('link', { name: 'Find a doctor' })).toHaveAttribute('aria-current', 'page');
    expect(nav.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
  });

  it('marks only Home as current on the role home page', () => {
    const nav = renderAt('/patient');

    expect(nav.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
    expect(nav.getByRole('link', { name: 'Find a doctor' })).not.toHaveAttribute('aria-current');
    expect(nav.getByRole('link', { name: 'Find care' })).not.toHaveAttribute('aria-current');
  });

  it('puts Profile in the account menu instead of the nav bar', async () => {
    const user = userEvent.setup();
    const nav = renderAt('/patient');

    expect(nav.queryByRole('link', { name: 'Profile' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'AL' }));
    const menu = await screen.findByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: 'Profile' })).toHaveAttribute('href', '/patient/profile');
    expect(within(menu).getByRole('menuitem', { name: 'Sign out' })).toBeInTheDocument();
    expect(within(menu).queryByRole('menuitem', { name: /all devices/i })).not.toBeInTheDocument();
  });
});
