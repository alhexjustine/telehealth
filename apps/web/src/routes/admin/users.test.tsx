import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { AdminUsersPage } from './users';
import { useAdminUsers, useChangeAccountStatus } from '@/lib/admin/use-admin-users';

vi.mock('@/lib/admin/use-admin-users', () => ({
  useAdminUsers: vi.fn(),
  useChangeAccountStatus: vi.fn(),
}));

function renderPage() {
  render(
    <MemoryRouter>
      <AdminUsersPage />
    </MemoryRouter>,
  );
}

describe('AdminUsersPage', () => {
  it('Deactivation warning', async () => {
    vi.mocked(useAdminUsers).mockReturnValue({
      isPending: false,
      data: {
        items: [
          {
            id: 'doc-1',
            email: 'doc@example.com',
            role: 'DOCTOR',
            status: 'ACTIVE',
            statusReason: null,
            displayName: 'Grace Hopper',
            createdAt: new Date().toISOString(),
            lastLoginAt: null,
            upcomingAppointmentCount: 3,
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      },
      status: 'success',
      error: null,
      refetch: vi.fn(),
    } as never);
    vi.mocked(useChangeAccountStatus).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);

    renderPage();

    await userEvent.click(screen.getByRole('button', { name: /deactivate/i }));

    expect(screen.getByText(/deactivate grace hopper/i)).toBeInTheDocument();
    expect(screen.getByText(/cancel 3 upcoming appointments/i)).toBeInTheDocument();

    const confirmButton = screen.getByRole('button', { name: /^deactivate account$/i });
    expect(confirmButton).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/reason/i), 'Credential fraud discovered');
    expect(confirmButton).not.toBeDisabled();
  });

  it('Pages through accounts five at a time', async () => {
    vi.mocked(useAdminUsers).mockReturnValue({
      isPending: false,
      data: {
        items: [
          {
            id: 'pat-1',
            email: 'pat@example.com',
            role: 'PATIENT',
            status: 'ACTIVE',
            statusReason: null,
            displayName: 'Ada Lovelace',
            createdAt: new Date().toISOString(),
            lastLoginAt: null,
            upcomingAppointmentCount: 0,
          },
        ],
        total: 12,
        page: 1,
        pageSize: 5,
      },
      status: 'success',
      error: null,
      refetch: vi.fn(),
    } as never);
    vi.mocked(useChangeAccountStatus).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);

    renderPage();

    expect(useAdminUsers).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, pageSize: 5 }));
    expect(screen.getByText(/page 1 of 3/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /next/i }));

    expect(useAdminUsers).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, pageSize: 5 }));
  });
});
