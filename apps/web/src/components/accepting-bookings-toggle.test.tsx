import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AcceptingBookingsToggle } from './accepting-bookings-toggle';
import { useDoctorProfile, useUpdateDoctorProfile } from '@/lib/doctors/use-doctor-profile';

vi.mock('@/lib/doctors/use-doctor-profile', () => ({
  useDoctorProfile: vi.fn(),
  useUpdateDoctorProfile: vi.fn(),
}));

function profileData(acceptingBookings: boolean) {
  return {
    firstName: 'Maria',
    lastName: 'Santos',
    bio: null,
    yearsOfExperience: null,
    licenseNumber: 'LIC-1',
    consultationMinutes: 30,
    acceptingBookings,
    verificationStatus: 'APPROVED',
    reviewNote: null,
    specializations: [],
  };
}

describe('AcceptingBookingsToggle', () => {
  it('Switch off from the home page', async () => {
    vi.mocked(useDoctorProfile).mockReturnValue({ data: profileData(true) } as never);
    const mutateAsync = vi.fn().mockResolvedValue(profileData(false));
    vi.mocked(useUpdateDoctorProfile).mockReturnValue({ mutateAsync, isPending: false } as never);

    render(<AcceptingBookingsToggle />);

    expect(screen.getByText('In')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('switch'));

    expect(mutateAsync).toHaveBeenCalledWith({ acceptingBookings: false });
  });

  it('shows "Out" when not accepting bookings', () => {
    vi.mocked(useDoctorProfile).mockReturnValue({ data: profileData(false) } as never);
    vi.mocked(useUpdateDoctorProfile).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);

    render(<AcceptingBookingsToggle />);

    expect(screen.getByText('Out')).toBeInTheDocument();
    expect(screen.getByRole('switch')).not.toBeChecked();
  });
});
