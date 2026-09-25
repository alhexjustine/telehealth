import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { PatientRecordDetailPage } from './record-detail';
import { apiClient } from '@/lib/api-client';

vi.mock('@/lib/api-client', () => ({
  apiClient: { GET: vi.fn(), POST: vi.fn(), PUT: vi.fn(), PATCH: vi.fn(), DELETE: vi.fn() },
}));

const ok = <T,>(data: T) => ({ data, error: undefined, response: { ok: true, status: 200 } as Response });

function renderPage() {
  const queryClient = new QueryClient();
  const router = createMemoryRouter(
    [{ path: '/patient/records/:appointmentId', element: <PatientRecordDetailPage /> }],
    { initialEntries: ['/patient/records/apt-1'] },
  );
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('PatientRecordDetailPage', () => {
  beforeEach(() => {
    vi.mocked(apiClient.GET).mockReset();
  });

  it('Patient opens a record', async () => {
    vi.mocked(apiClient.GET).mockImplementation(((path: unknown) => {
      if (path === '/records/{appointmentId}') {
        return Promise.resolve(
          ok({
            appointmentId: 'apt-1',
            startsAt: '2026-01-01T10:00:00.000Z',
            doctor: { id: 'doc-1', displayName: 'Dr. Grace Hopper', specializations: [] },
            note: {
              findings: 'Mild fever',
              assessment: 'Common cold',
              plan: 'Rest and hydrate',
              patientSummary: 'You have a mild cold; rest and hydrate.',
              updatedAt: '2026-01-01T10:20:00.000Z',
            },
            prescriptions: [
              {
                id: 'rx-1',
                medication: 'Amoxicillin',
                dosage: '500 mg',
                frequency: '3 times a day',
                duration: '7 days',
                instructions: null,
                createdAt: '2026-01-01T10:15:00.000Z',
                updatedAt: '2026-01-01T10:15:00.000Z',
              },
            ],
          }),
        );
      }
      throw new Error(`unexpected GET ${String(path)}`);
    }) as never);

    renderPage();

    expect(await screen.findByText('You have a mild cold; rest and hydrate.')).toBeInTheDocument();
    expect(screen.getByText('Mild fever')).toBeInTheDocument();
    expect(screen.getByText(/amoxicillin/i)).toBeInTheDocument();
  });
});
