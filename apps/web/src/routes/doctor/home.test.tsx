import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { DoctorHomePage } from './home';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import { useDoctorProfile } from '@/lib/doctors/use-doctor-profile';

vi.mock('@/lib/auth/use-current-user', () => ({ useCurrentUser: vi.fn() }));
vi.mock('@/lib/doctors/use-doctor-profile', () => ({ useDoctorProfile: vi.fn() }));

function renderHome() {
  render(
    <MemoryRouter>
      <DoctorHomePage />
    </MemoryRouter>,
  );
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

    renderHome();

    expect(screen.getByText(/verification rejected/i)).toBeInTheDocument();
    expect(screen.getByText(/license could not be verified/i)).toBeInTheDocument();
  });
});
