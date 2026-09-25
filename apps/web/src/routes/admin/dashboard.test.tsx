import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { AdminDashboardPage } from './dashboard';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import { useAdminDashboard } from '@/lib/admin/use-admin-dashboard';

vi.mock('@/lib/auth/use-current-user', () => ({ useCurrentUser: vi.fn() }));
vi.mock('@/lib/admin/use-admin-dashboard', () => ({ useAdminDashboard: vi.fn() }));

function renderDashboard() {
  render(
    <MemoryRouter>
      <AdminDashboardPage />
    </MemoryRouter>,
  );
}

describe('AdminDashboardPage', () => {
  it('Tile links to work queue', () => {
    vi.mocked(useCurrentUser).mockReturnValue({
      data: { id: 'a1', email: 'admin@example.com', role: 'ADMIN', status: 'ACTIVE', displayName: 'Administrator' },
    } as never);
    vi.mocked(useAdminDashboard).mockReturnValue({
      data: {
        patients: { ACTIVE: 10, SUSPENDED: 1, DEACTIVATED: 0 },
        doctors: { ACTIVE: 5, SUSPENDED: 0, DEACTIVATED: 0 },
        doctorVerification: { PENDING: 3, APPROVED: 5, REJECTED: 1 },
        appointmentsToday: { BOOKED: 2, CANCELLED: 0, COMPLETED: 0, NOT_HELD: 0 },
        appointmentsUpcoming: { BOOKED: 4, CANCELLED: 0, COMPLETED: 0, NOT_HELD: 0 },
        appointmentsAllTime: { BOOKED: 4, CANCELLED: 1, COMPLETED: 10, NOT_HELD: 1 },
        consultationsInProgress: 0,
        consultationsCompletedToday: 1,
        consultationsCompletedLast7Days: 3,
        pendingDoctorReviews: 3,
        invalidBookings: 2,
        trend: [{ date: '2026-06-15', count: 1, isToday: true }],
        timezone: 'UTC',
      },
      status: 'success',
      error: null,
      refetch: vi.fn(),
    } as never);

    renderDashboard();

    const pendingTile = screen.getByRole('link', { name: /pending doctor reviews: 3/i });
    expect(pendingTile).toHaveAttribute('href', '/admin/doctors?verification=PENDING');

    const invalidTile = screen.getByRole('link', { name: /invalid bookings: 2/i });
    expect(invalidTile).toHaveAttribute('href', '/admin/appointments?invalidOnly=true');
  });
});
