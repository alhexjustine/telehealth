import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { PatientRecordDetailPage } from './record-detail';
import { apiClient } from '@/lib/api-client';

vi.mock('@/lib/api-client', () => ({
  apiClient: { GET: vi.fn(), POST: vi.fn(), PUT: vi.fn(), PATCH: vi.fn(), DELETE: vi.fn() },
}));

const ok = <T,>(data: T) => ({ data, error: undefined, response: { ok: true, status: 200 } as Response });

const BASE_RECORD = {
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
      refillRequests: [] as { id: string; status: string; patientNote: string | null; doctorNote: string | null; decidedAt: string | null; createdAt: string }[],
    },
  ],
};

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
        return Promise.resolve(ok(BASE_RECORD));
      }
      throw new Error(`unexpected GET ${String(path)}`);
    }) as never);

    renderPage();

    expect(await screen.findByText('You have a mild cold; rest and hydrate.')).toBeInTheDocument();
    expect(screen.getByText('Mild fever')).toBeInTheDocument();
    expect(screen.getByText(/amoxicillin/i)).toBeInTheDocument();
  });

  it('Request a refill', async () => {
    vi.mocked(apiClient.GET).mockImplementation(((path: unknown) => {
      if (path === '/records/{appointmentId}') return Promise.resolve(ok(BASE_RECORD));
      throw new Error(`unexpected GET ${String(path)}`);
    }) as never);
    const postMock = vi.fn().mockResolvedValue(
      ok({
        id: 'refill-1',
        status: 'PENDING',
        patientNote: 'still symptomatic',
        doctorNote: null,
        decidedAt: null,
        createdAt: '2026-01-02T00:00:00.000Z',
      }),
    );
    vi.mocked(apiClient.POST).mockImplementation(postMock as never);

    renderPage();
    await screen.findByText(/amoxicillin/i);

    await userEvent.click(screen.getByRole('button', { name: /request refill/i }));
    await userEvent.type(screen.getByPlaceholderText(/optional note/i), 'still symptomatic');
    await userEvent.click(screen.getByRole('button', { name: /submit request/i }));

    await waitFor(() =>
      expect(postMock).toHaveBeenCalledWith(
        '/records/{appointmentId}/prescriptions/{prescriptionId}/refill-requests',
        expect.objectContaining({
          params: { path: { appointmentId: 'apt-1', prescriptionId: 'rx-1' } },
          body: { patientNote: 'still symptomatic' },
        }),
      ),
    );
  });

  it('Pending request hides the button', async () => {
    vi.mocked(apiClient.GET).mockImplementation(((path: unknown) => {
      if (path === '/records/{appointmentId}') {
        return Promise.resolve(
          ok({
            ...BASE_RECORD,
            prescriptions: [
              {
                ...BASE_RECORD.prescriptions[0],
                refillRequests: [
                  {
                    id: 'refill-1',
                    status: 'PENDING',
                    patientNote: 'still symptomatic',
                    doctorNote: null,
                    decidedAt: null,
                    createdAt: '2026-01-02T00:00:00.000Z',
                  },
                ],
              },
            ],
          }),
        );
      }
      throw new Error(`unexpected GET ${String(path)}`);
    }) as never);

    renderPage();
    await screen.findByText(/amoxicillin/i);

    expect(screen.getByText(/refill requested/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /request refill/i })).not.toBeInTheDocument();
  });
});
