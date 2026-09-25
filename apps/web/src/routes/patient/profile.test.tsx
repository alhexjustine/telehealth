import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { PatientProfilePage } from './profile';
import { usePatientProfile, useUpdatePatientProfile } from '@/lib/patients/use-patient-profile';

vi.mock('@/lib/patients/use-patient-profile', () => ({
  usePatientProfile: vi.fn(),
  useUpdatePatientProfile: vi.fn(),
}));

const baseProfile = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  birthDate: null,
  weightKg: null,
  heightCm: null,
  phone: null,
  emergencyContactName: null,
  emergencyContactPhone: null,
  medicalConditions: null,
  allergies: null,
  currentMedications: null,
  profileComplete: false,
};

describe('PatientProfilePage', () => {
  it('Inline validation', async () => {
    const mutateAsync = vi.fn();
    vi.mocked(usePatientProfile).mockReturnValue({
      data: baseProfile,
      status: 'success',
      error: null,
      refetch: vi.fn(),
      isPending: false,
    } as never);
    vi.mocked(useUpdatePatientProfile).mockReturnValue({ mutateAsync, isPending: false } as never);

    render(
      <MemoryRouter>
        <PatientProfilePage />
      </MemoryRouter>,
    );

    const weightInput = await screen.findByLabelText(/weight/i);
    await userEvent.clear(weightInput);
    await userEvent.type(weightInput, '0');
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

    expect(await screen.findByText(/weight must be at least 1/i)).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
  });
});
