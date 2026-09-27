import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { DoctorHomePage } from './home';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import { useDoctorProfile } from '@/lib/doctors/use-doctor-profile';
import { useAvailability } from '@/lib/availability/use-availability';
import { useAppointments } from '@/lib/appointments/use-appointments';

vi.mock('@/lib/auth/use-current-user', () => ({ useCurrentUser: vi.fn() }));
vi.mock('@/lib/doctors/use-doctor-profile', () => ({
  useDoctorProfile: vi.fn(),
  useUpdateDoctorProfile: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
}));
vi.mock('@/lib/availability/use-availability', () => ({ useAvailability: vi.fn() }));
vi.mock('@/lib/appointments/use-appointments', () => ({ useAppointments: vi.fn() }));

function renderHome() {
  render(
    <MemoryRouter>
      <DoctorHomePage />
    </MemoryRouter>,
  );
}

function mockNoAppointments() {
  vi.mocked(useAvailability).mockReturnValue({ data: { timezone: 'UTC' } } as never);
  vi.mocked(useAppointments).mockReturnValue({
    data: { items: [], total: 0, page: 1, pageSize: 20 },
    status: 'success',
    error: null,
    refetch: vi.fn(),
  } as never);
}

describe('DoctorHomePage', () => {
  it('Pending doctor', () => {
    vi.mocked(useCurrentUser).mockReturnValue({
      data: {
        id: '1',
        email: 'd@example.com',
        role: 'DOCTOR',
        status: 'ACTIVE',
        displayName: 'Grace Hopper',
        verificationStatus: 'PENDING',
      },
    } as never);
    vi.mocked(useDoctorProfile).mockReturnValue({ data: undefined } as never);
    mockNoAppointments();

    renderHome();

    expect(screen.getByText(/verification pending/i)).toBeInTheDocument();
    expect(screen.getByText(/awaiting administrator review/i)).toBeInTheDocument();
  });

  it('Rejected doctor', () => {
    vi.mocked(useCurrentUser).mockReturnValue({
      data: {
        id: '1',
        email: 'd@example.com',
        role: 'DOCTOR',
        status: 'ACTIVE',
        displayName: 'Grace Hopper',
        verificationStatus: 'REJECTED',
      },
    } as never);
    vi.mocked(useDoctorProfile).mockReturnValue({
      data: { reviewNote: 'License could not be verified' },
    } as never);
    mockNoAppointments();

    renderHome();

    expect(screen.getByText(/verification rejected/i)).toBeInTheDocument();
    expect(screen.getByText(/license could not be verified/i)).toBeInTheDocument();
  });

  it("Doctor's today list", () => {
    vi.mocked(useCurrentUser).mockReturnValue({
      data: {
        id: '1',
        email: 'd@example.com',
        role: 'DOCTOR',
        status: 'ACTIVE',
        displayName: 'Grace Hopper',
        verificationStatus: 'APPROVED',
      },
    } as never);
    vi.mocked(useDoctorProfile).mockReturnValue({ data: undefined } as never);
    vi.mocked(useAvailability).mockReturnValue({ data: { timezone: 'UTC' } } as never);

    const now = new Date();
    const todayIso = (hour: number) => {
      const d = new Date(now);
      d.setUTCHours(hour, 0, 0, 0);
      return d.toISOString();
    };
    const tomorrowIso = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

    // Already in start order, as the real "upcoming" list endpoint returns.
    vi.mocked(useAppointments).mockReturnValue({
      data: {
        items: [
          { id: 'a1', startsAt: todayIso(9), patient: { displayName: 'Ada Lovelace', age: 30 }, reason: 'Checkup' },
          { id: 'a3', startsAt: todayIso(11), patient: { displayName: 'Rosalind Franklin', age: 35 }, reason: 'Consult' },
          { id: 'a2', startsAt: todayIso(14), patient: { displayName: 'Alan Turing', age: 40 }, reason: 'Follow-up' },
          { id: 'a4', startsAt: tomorrowIso, patient: { displayName: 'Not Today', age: 20 }, reason: 'Later' },
        ],
        total: 4,
        page: 1,
        pageSize: 20,
      },
      status: 'success',
      error: null,
      refetch: vi.fn(),
    } as never);

    renderHome();

    const names = screen.getAllByText(/Lovelace|Turing|Franklin/);
    expect(names.map((el) => el.textContent)).toEqual(['Ada Lovelace', 'Rosalind Franklin', 'Alan Turing']);
    expect(screen.queryByText('Not Today')).not.toBeInTheDocument();
    expect(screen.getByText('Checkup')).toBeInTheDocument();
  });

  it('links to the doctor areas from the action cards', () => {
    vi.mocked(useCurrentUser).mockReturnValue({
      data: { id: '1', email: 'd@example.com', role: 'DOCTOR', status: 'ACTIVE', displayName: 'Grace Hopper', verificationStatus: 'APPROVED' },
    } as never);
    vi.mocked(useDoctorProfile).mockReturnValue({ data: undefined } as never);
    mockNoAppointments();

    renderHome();
    const actions = within(screen.getByRole('region', { name: 'What would you like to do?' }));

    expect(actions.getByRole('link', { name: /^appointments/i })).toHaveAttribute('href', '/doctor/appointments');
    expect(actions.getByRole('link', { name: /^schedule/i })).toHaveAttribute('href', '/doctor/schedule');
    expect(actions.queryByRole('link', { name: /^profile/i })).not.toBeInTheDocument();
    expect(actions.queryByRole('link', { name: /^notifications/i })).not.toBeInTheDocument();
  });
});
