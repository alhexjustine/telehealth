import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { AdminAuditPage } from './audit';
import { useAdminAuditLog } from '@/lib/admin/use-admin-audit';

vi.mock('@/lib/admin/use-admin-audit', () => ({ useAdminAuditLog: vi.fn() }));

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/admin/audit']}>
      <AdminAuditPage />
    </MemoryRouter>,
  );
}

describe('AdminAuditPage', () => {
  it('Diff view', async () => {
    vi.mocked(useAdminAuditLog).mockReturnValue({
      isPending: false,
      data: {
        items: [
          {
            id: 'audit-1',
            actorId: 'admin-1',
            actorEmail: 'admin@example.com',
            action: 'DOCTOR_PROFILE_UPDATED',
            entityType: 'DoctorProfile',
            entityId: 'doc-1',
            reason: null,
            before: { specializationIds: ['spec-1'] },
            after: { specializationIds: ['spec-2'] },
            requestId: 'req-1',
            ip: '127.0.0.1',
            userAgent: null,
            createdAt: new Date().toISOString(),
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

    renderPage();

    await userEvent.click(screen.getByRole('button', { name: /doctor_profile_updated/i }));

    expect(screen.getByText('specializationIds')).toBeInTheDocument();
    expect(screen.getByText('spec-1')).toBeInTheDocument();
    expect(screen.getByText('spec-2')).toBeInTheDocument();
  });

  it('Pages through entries five at a time', async () => {
    vi.mocked(useAdminAuditLog).mockReturnValue({
      isPending: false,
      data: {
        items: [
          {
            id: 'audit-1',
            actorId: 'admin-1',
            actorEmail: 'admin@example.com',
            action: 'ADMIN_SIGNED_IN',
            entityType: 'User',
            entityId: 'user-1',
            reason: null,
            before: null,
            after: null,
            requestId: 'req-1',
            ip: '127.0.0.1',
            userAgent: null,
            createdAt: new Date().toISOString(),
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

    renderPage();

    expect(useAdminAuditLog).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, pageSize: 5 }));
    expect(screen.getByText(/page 1 of 3/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: /next/i }));

    expect(useAdminAuditLog).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, pageSize: 5 }));
  });
});
