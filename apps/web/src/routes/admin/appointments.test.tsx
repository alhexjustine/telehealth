import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { AdminAppointmentsPage } from './appointments';
import {
  useAdminAppointments,
  useAdminCancelAppointment,
  useMarkNotHeld,
  type AdminAppointmentListQuery,
} from '@/lib/admin/use-admin-appointments';

vi.mock('@/lib/admin/use-admin-appointments', async () => {
  const actual = await vi.importActual('@/lib/admin/use-admin-appointments');
  return { ...actual, useAdminAppointments: vi.fn(), useAdminCancelAppointment: vi.fn(), useMarkNotHeld: vi.fn() };
});

function appointment(overrides: Partial<{ id: string; flags: string[] }> = {}) {
  return {
    id: overrides.id ?? 'appt-1',
    startsAt: new Date().toISOString(),
    endsAt: new Date(Date.now() + 30 * 60_000).toISOString(),
    status: 'BOOKED',
    doctor: { id: 'doc-1', displayName: 'Grace Hopper' },
    patient: { id: 'pat-1', displayName: 'Ada Lovelace' },
    consultationState: 'SCHEDULED',
    flags: overrides.flags ?? ['DOCTOR_UNAVAILABLE'],
    cancelledAt: null,
    cancelledByRole: null,
    cancellationReason: null,
    resolutionReason: null,
  };
}

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/admin/appointments']}>
      <AdminAppointmentsPage />
    </MemoryRouter>,
  );
}

describe('AdminAppointmentsPage', () => {
  it('Invalid-only view', async () => {
    vi.mocked(useAdminCancelAppointment).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
    vi.mocked(useMarkNotHeld).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);

    const flagged = appointment({ id: 'appt-flagged', flags: ['DOCTOR_UNAVAILABLE'] });
    const clean = appointment({ id: 'appt-clean', flags: [] });

    vi.mocked(useAdminAppointments).mockImplementation((query: AdminAppointmentListQuery) => {
      const items = query.invalidOnly ? [flagged] : [flagged, clean];
      return { isPending: false, data: { items, total: items.length, page: 1, pageSize: 20 } } as never;
    });

    renderPage();

    // Both appointments visible before filtering.
    expect(screen.getAllByText('Ada Lovelace with Dr. Grace Hopper')).toHaveLength(2);

    await userEvent.click(screen.getByRole('checkbox', { name: /invalid only/i }));

    expect(screen.getAllByText('Ada Lovelace with Dr. Grace Hopper')).toHaveLength(1);
    expect(screen.getByText('DOCTOR_UNAVAILABLE')).toBeInTheDocument();
  });
});
