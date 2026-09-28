import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { DoctorPatientRecordPage } from './patient-record';
import { apiClient } from '@/lib/api-client';

vi.mock('@/lib/api-client', () => ({
  apiClient: { GET: vi.fn(), POST: vi.fn(), PUT: vi.fn(), PATCH: vi.fn(), DELETE: vi.fn() },
}));

const ok = <T,>(data: T) => ({ data, error: undefined, response: { ok: true, status: 200 } as Response });

function renderPage(initialEntry = '/doctor/patients/pat-1') {
  const queryClient = new QueryClient();
  const router = createMemoryRouter(
    [{ path: '/doctor/patients/:patientId', element: <DoctorPatientRecordPage /> }],
    { initialEntries: [initialEntry] },
  );
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('DoctorPatientRecordPage', () => {
  beforeEach(() => {
    vi.mocked(apiClient.GET).mockReset();
  });

  it('Doctor opens a patient record', async () => {
    vi.mocked(apiClient.GET).mockImplementation(((path: unknown) => {
      if (path === '/patients/{patientId}/record') {
        return Promise.resolve(
          ok({
            patientId: 'pat-1',
            firstName: 'Ada',
            lastName: 'Lovelace',
            age: 30,
            medicalConditions: 'Asthma',
            allergies: 'Penicillin',
            currentMedications: 'Albuterol',
            appointmentsWithDoctor: [
              { id: 'apt-1', startsAt: '2026-01-01T10:00:00.000Z', endsAt: '2026-01-01T10:30:00.000Z', status: 'COMPLETED', reason: 'Checkup' },
            ],
            completedConsultations: [
              {
                appointmentId: 'apt-1',
                startsAt: '2026-01-01T10:00:00.000Z',
                doctor: { id: 'doc-1', displayName: 'Dr. Grace Hopper', specializations: [] },
                patientSummary: 'All clear.',
              },
            ],
          }),
        );
      }
      throw new Error(`unexpected GET ${String(path)}`);
    }) as never);

    renderPage();

    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('Asthma')).toBeInTheDocument();
    expect(screen.getByText('Penicillin')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /dr\. grace hopper/i });
    expect(link).toHaveAttribute('href', '/consultations/apt-1');
  });

  it("Doctor opens a dependent's record", async () => {
    vi.mocked(apiClient.GET).mockImplementation(((path: unknown) => {
      if (path === '/patients/{patientId}/record') {
        return Promise.resolve(
          ok({
            patientId: 'pat-1',
            dependentId: 'dep-1',
            relationship: 'CHILD',
            firstName: 'Jamie',
            lastName: 'Lovelace',
            age: 7,
            medicalConditions: null,
            allergies: 'Peanuts',
            currentMedications: null,
            appointmentsWithDoctor: [],
            completedConsultations: [],
          }),
        );
      }
      throw new Error(`unexpected GET ${String(path)}`);
    }) as never);

    renderPage('/doctor/patients/pat-1?dependentId=dep-1');

    expect(await screen.findByText('Jamie Lovelace')).toBeInTheDocument();
    expect(screen.getByText('(Child)')).toBeInTheDocument();
    expect(screen.getByText('Peanuts')).toBeInTheDocument();
  });
});
