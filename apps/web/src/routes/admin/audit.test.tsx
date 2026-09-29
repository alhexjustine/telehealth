import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { AdminAuditPage } from './audit';
import { useAdminAuditLog } from '@/lib/admin/use-admin-audit';

vi.mock('@/lib/admin/use-admin-audit', () => ({ useAdminAuditLog: vi.fn() }));

function renderPage(initialEntries: string[] = ['/admin/audit']) {
  render(
    <MemoryRouter initialEntries={initialEntries}>
      <AdminAuditPage />
    </MemoryRouter>,
  );
}

function mockEmptyList() {
  vi.mocked(useAdminAuditLog).mockReturnValue({
    isPending: false,
    data: { items: [], total: 0, page: 1, pageSize: 5 },
    status: 'success',
    error: null,
    refetch: vi.fn(),
  } as never);
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

  afterEach(() => {
    vi.useRealTimers();
  });

  it('Filtering by record type', async () => {
    mockEmptyList();
    renderPage();

    await userEvent.click(screen.getByRole('combobox', { name: /record type/i }));
    await userEvent.click(await screen.findByRole('option', { name: 'DoctorProfile' }));

    expect(useAdminAuditLog).toHaveBeenLastCalledWith(
      expect.objectContaining({ entityType: 'DoctorProfile', entityId: undefined }),
    );
  });

  it('Filtering by action', async () => {
    mockEmptyList();
    renderPage();

    await userEvent.click(screen.getByRole('combobox', { name: /^action$/i }));
    await userEvent.click(await screen.findByRole('option', { name: 'Doctor Approved' }));

    expect(useAdminAuditLog).toHaveBeenLastCalledWith(expect.objectContaining({ action: 'DOCTOR_APPROVED' }));
  });

  it('Record ID filter withholds invalid/partial input and commits a full UUID after debounce', () => {
    vi.useFakeTimers();
    mockEmptyList();
    renderPage();

    const input = screen.getByLabelText(/record id/i);
    fireEvent.change(input, { target: { value: '1234' } });
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(useAdminAuditLog).not.toHaveBeenCalledWith(expect.objectContaining({ entityId: '1234' }));
    expect(screen.getByText(/enter the record's full id/i)).toBeInTheDocument();

    const fullUuid = '11111111-1111-4111-8111-111111111111';
    fireEvent.change(input, { target: { value: fullUuid } });
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(useAdminAuditLog).toHaveBeenLastCalledWith(expect.objectContaining({ entityId: fullUuid }));
  });

  it('Clear filters resets action, record type, and record ID', async () => {
    mockEmptyList();
    renderPage([
      '/admin/audit?action=ADMIN_SIGNED_IN&entityType=User&entityId=11111111-1111-4111-8111-111111111111',
    ]);

    await userEvent.click(screen.getByRole('button', { name: /clear filters/i }));

    expect(useAdminAuditLog).toHaveBeenLastCalledWith(
      expect.objectContaining({ action: undefined, entityType: undefined, entityId: undefined }),
    );
    expect(screen.getByLabelText(/record id/i)).toHaveValue('');
  });
});
