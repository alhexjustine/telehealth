import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { AdminDoctorsPage } from './doctors';
import { useAdminDoctors, type AdminDoctorListQuery } from '@/lib/admin/use-admin-doctors';

vi.mock('@/lib/admin/use-admin-doctors', () => ({ useAdminDoctors: vi.fn() }));

function doctorRow(overrides: Partial<{ id: string; displayName: string }> = {}) {
  return {
    id: overrides.id ?? 'doc-1',
    displayName: overrides.displayName ?? 'Grace Hopper',
    email: 'grace@example.com',
    licenseNumber: 'LIC-1',
    verificationStatus: 'PENDING',
    accountStatus: 'ACTIVE',
    specializations: [],
    updatedAt: new Date().toISOString(),
  };
}

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/admin/doctors?verification=PENDING']}>
      <AdminDoctorsPage />
    </MemoryRouter>,
  );
}

describe('AdminDoctorsPage', () => {
  it('Approve from the review page (doctor moves from pending tab to approved tab)', async () => {
    // Simulates the server-side effect of approving Grace Hopper: she now
    // appears under the APPROVED tab's query and no longer under PENDING's.
    vi.mocked(useAdminDoctors).mockImplementation((query: AdminDoctorListQuery) => {
      if (query.verification === 'APPROVED') {
        return {
          isPending: false,
          data: { items: [doctorRow()], total: 1, page: 1, pageSize: 50 },
          status: 'success',
          error: null,
          refetch: vi.fn(),
        } as never;
      }
      return {
        isPending: false,
        data: { items: [], total: 0, page: 1, pageSize: 50 },
        status: 'success',
        error: null,
        refetch: vi.fn(),
      } as never;
    });

    renderPage();

    expect(screen.queryByText('Grace Hopper')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: /approved/i }));

    expect(screen.getByText('Grace Hopper')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /grace hopper/i })).toHaveAttribute('href', '/admin/doctors/doc-1');
  });
});
