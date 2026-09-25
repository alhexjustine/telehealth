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
    } as never);

    renderPage();

    await userEvent.click(screen.getByRole('button', { name: /doctor_profile_updated/i }));

    expect(screen.getByText('specializationIds')).toBeInTheDocument();
    expect(screen.getByText('spec-1')).toBeInTheDocument();
    expect(screen.getByText('spec-2')).toBeInTheDocument();
  });
});
