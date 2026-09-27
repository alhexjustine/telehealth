import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { AdminDoctorDetailPage } from './doctor-detail';
import {
  useAdminDoctor,
  useApproveDoctor,
  useRejectDoctor,
  useUpdateAdminDoctorProfile,
} from '@/lib/admin/use-admin-doctors';
import { useSpecializations } from '@/lib/use-specializations';

vi.mock('@/lib/admin/use-admin-doctors', () => ({
  useAdminDoctor: vi.fn(),
  useApproveDoctor: vi.fn(),
  useRejectDoctor: vi.fn(),
  useUpdateAdminDoctorProfile: vi.fn(),
}));
vi.mock('@/lib/use-specializations', () => ({ useSpecializations: vi.fn() }));

function doctorProfile(overrides: Partial<{ verificationStatus: string }> = {}) {
  return {
    id: 'doc-1',
    email: 'grace@example.com',
    firstName: 'Grace',
    lastName: 'Hopper',
    bio: null,
    yearsOfExperience: null,
    licenseNumber: 'LIC-1',
    consultationMinutes: 30,
    verificationStatus: overrides.verificationStatus ?? 'PENDING',
    reviewNote: null,
    accountStatus: 'ACTIVE',
    accountStatusReason: null,
    specializations: [],
    updatedAt: new Date().toISOString(),
  };
}

function renderPage(verificationStatus: string) {
  vi.mocked(useAdminDoctor).mockReturnValue({
    isPending: false,
    data: doctorProfile({ verificationStatus }),
    status: 'success',
    error: null,
    refetch: vi.fn(),
  } as never);
  vi.mocked(useApproveDoctor).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
  vi.mocked(useRejectDoctor).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
  vi.mocked(useUpdateAdminDoctorProfile).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
  vi.mocked(useSpecializations).mockReturnValue({
    isPending: false,
    data: [],
    status: 'success',
    error: null,
    refetch: vi.fn(),
  } as never);

  render(
    <MemoryRouter initialEntries={['/admin/doctors/doc-1']}>
      <Routes>
        <Route path="/admin/doctors/:doctorId" element={<AdminDoctorDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AdminDoctorDetailPage', () => {
  it('Reject disabled for an approved doctor', () => {
    renderPage('APPROVED');

    expect(screen.getByRole('button', { name: /^reject$/i })).toBeDisabled();
  });

  it('Reject enabled for a pending doctor', () => {
    renderPage('PENDING');

    expect(screen.getByRole('button', { name: /^reject$/i })).not.toBeDisabled();
  });

  it('Approved doctor points to account actions', () => {
    renderPage('APPROVED');

    expect(screen.getByText(/can be suspended or deactivated/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Users' })).toHaveAttribute('href', '/admin/users');
  });

  it('Pending doctor shows no account-actions note', () => {
    renderPage('PENDING');

    expect(screen.queryByText(/can be suspended or deactivated/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Users' })).not.toBeInTheDocument();
  });
});
