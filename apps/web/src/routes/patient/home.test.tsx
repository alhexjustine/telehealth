import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { PatientHomePage } from './home';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import { useAppointments } from '@/lib/appointments/use-appointments';

vi.mock('@/lib/auth/use-current-user', () => ({ useCurrentUser: vi.fn() }));
vi.mock('@/lib/appointments/use-appointments', () => ({ useAppointments: vi.fn() }));

function mockUpcoming(items: unknown[]) {
  vi.mocked(useAppointments).mockReturnValue({
    status: 'success',
    data: { items, total: items.length, page: 1, pageSize: 20 },
    error: null,
    refetch: vi.fn(),
  } as never);
}

function appointment(id: string, doctorName: string, startsAt: string) {
  return {
    id,
    status: 'BOOKED',
    startsAt,
    endsAt: new Date(new Date(startsAt).getTime() + 30 * 60_000).toISOString(),
    doctor: { id: `doc-${id}`, displayName: doctorName },
  };
}

function renderHome(upcoming: unknown[] = []) {
  mockUpcoming(upcoming);
  render(
    <MemoryRouter>
      <PatientHomePage />
    </MemoryRouter>,
  );
}

describe('PatientHomePage', () => {
  it('Incomplete profile prompt', () => {
    vi.mocked(useCurrentUser).mockReturnValue({
      data: {
        id: '1',
        email: 'p@example.com',
        role: 'PATIENT',
        status: 'ACTIVE',
        displayName: 'Ada Lovelace',
        profileComplete: false,
      },
    } as never);

    renderHome();

    expect(screen.getByText('Complete your profile')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /go to your profile/i })).toHaveAttribute(
      'href',
      '/patient/profile',
    );
  });

  it('does not show the prompt once the profile is complete', () => {
    vi.mocked(useCurrentUser).mockReturnValue({
      data: {
        id: '1',
        email: 'p@example.com',
        role: 'PATIENT',
        status: 'ACTIVE',
        displayName: 'Ada Lovelace',
        profileComplete: true,
      },
    } as never);

    renderHome();

    expect(screen.queryByText(/complete your profile/i)).not.toBeInTheDocument();
  });

  it('links to the four patient areas', () => {
    vi.mocked(useCurrentUser).mockReturnValue({
      data: {
        id: '1',
        email: 'p@example.com',
        role: 'PATIENT',
        status: 'ACTIVE',
        displayName: 'Ada Lovelace',
        profileComplete: true,
      },
    } as never);

    renderHome();
    const actions = within(screen.getByRole('region', { name: 'What would you like to do?' }));

    expect(actions.getByRole('link', { name: /^find a doctor/i })).toHaveAttribute('href', '/patient/doctors');
    expect(actions.getByRole('link', { name: /^find care by symptoms/i })).toHaveAttribute(
      'href',
      '/patient/find-care',
    );
    expect(actions.getByRole('link', { name: /^your appointments/i })).toHaveAttribute(
      'href',
      '/patient/appointments',
    );
    expect(actions.getByRole('link', { name: /^your records/i })).toHaveAttribute('href', '/patient/records');
  });

  it("lists only today's appointments", () => {
    vi.mocked(useCurrentUser).mockReturnValue({
      data: { id: '1', email: 'p@example.com', role: 'PATIENT', status: 'ACTIVE', displayName: 'Ada Lovelace', profileComplete: true },
    } as never);

    const now = new Date();
    const todayIso = (hour: number) => {
      const d = new Date(now);
      d.setHours(hour, 0, 0, 0); // local time: the component uses the runtime's own local timezone
      return d.toISOString();
    };
    const tomorrowIso = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

    renderHome([
      appointment('a1', 'Dr. Maria Santos', todayIso(9)),
      appointment('a2', 'Dr. Ana Reyes', todayIso(14)),
      appointment('a3', 'Dr. Liza Cruz', tomorrowIso),
    ]);

    expect(screen.getByText('Dr. Maria Santos')).toBeInTheDocument();
    expect(screen.getByText('Dr. Ana Reyes')).toBeInTheDocument();
    expect(screen.queryByText('Dr. Liza Cruz')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'View all' })).not.toBeInTheDocument();
  });

  it('shows an empty state with a way to book when nothing is today', () => {
    vi.mocked(useCurrentUser).mockReturnValue({
      data: { id: '1', email: 'p@example.com', role: 'PATIENT', status: 'ACTIVE', displayName: 'Ada Lovelace', profileComplete: true },
    } as never);

    renderHome([]);

    expect(screen.getByText(/no appointments today/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Find a doctor' })).toHaveAttribute('href', '/patient/doctors');
  });
});
