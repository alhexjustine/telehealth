import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { DoctorProfilePage } from './profile';
import { useDoctorProfile, useUpdateDoctorProfile } from '@/lib/doctors/use-doctor-profile';
import { useSpecializations } from '@/lib/use-specializations';

vi.mock('@/lib/auth/mutations', () => ({
  useLogoutAllMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/lib/doctors/use-doctor-profile', () => ({
  useDoctorProfile: vi.fn(),
  useUpdateDoctorProfile: vi.fn(),
}));
vi.mock('@/lib/use-specializations', () => ({ useSpecializations: vi.fn() }));

const specializations = [
  { id: 'spec-1', slug: 'general-practice', name: 'General Practice', description: '' },
  { id: 'spec-2', slug: 'cardiology', name: 'Cardiology', description: '' },
];

const baseProfile = {
  firstName: 'Grace',
  lastName: 'Hopper',
  bio: null,
  yearsOfExperience: null,
  licenseNumber: 'LIC-0001',
  consultationMinutes: 30 as const,
  verificationStatus: 'PENDING' as const,
  reviewNote: null,
  specializations: [{ id: 'spec-1', name: 'General Practice' }],
};

describe('DoctorProfilePage', () => {
  it('Edit specializations', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({
      ...baseProfile,
      specializations: [
        { id: 'spec-1', name: 'General Practice' },
        { id: 'spec-2', name: 'Cardiology' },
      ],
    });
    vi.mocked(useDoctorProfile).mockReturnValue({
      data: baseProfile,
      status: 'success',
      error: null,
      refetch: vi.fn(),
      isPending: false,
    } as never);
    vi.mocked(useUpdateDoctorProfile).mockReturnValue({ mutateAsync, isPending: false } as never);
    vi.mocked(useSpecializations).mockReturnValue({
      data: specializations,
      isPending: false,
    } as never);

    render(
      <MemoryRouter>
        <DoctorProfilePage />
      </MemoryRouter>,
    );

    const cardiologyCheckbox = await screen.findByLabelText('Cardiology');
    expect(cardiologyCheckbox).not.toBeChecked();
    await userEvent.click(cardiologyCheckbox);
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ specializationIds: ['spec-1', 'spec-2'] }),
    );
  });
});
