import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { FindCarePage } from './find-care';
import { apiClient } from '@/lib/api-client';

vi.mock('@/lib/api-client', () => ({
  apiClient: { GET: vi.fn(), PUT: vi.fn(), POST: vi.fn(), DELETE: vi.fn() },
}));

const ok = <T,>(data: T) => ({ data, error: undefined, response: { ok: true, status: 200 } as Response });

const CATALOG = [
  {
    category: 'Heart & Circulation',
    symptoms: [{ id: 'chest-pain', slug: 'chest-pain', name: 'Chest pain', category: 'Heart & Circulation', isRedFlag: true }],
  },
  {
    category: 'Respiratory',
    symptoms: [{ id: 'cough', slug: 'cough', name: 'Cough', category: 'Respiratory', isRedFlag: false }],
  },
];

function renderPage() {
  const queryClient = new QueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <FindCarePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('FindCarePage', () => {
  beforeEach(() => {
    vi.mocked(apiClient.GET).mockReset();
    vi.mocked(apiClient.POST).mockReset();
    vi.mocked(apiClient.GET).mockImplementation(((path: unknown) => {
      if (path === '/symptoms') return Promise.resolve(ok(CATALOG));
      throw new Error(`unexpected GET ${String(path)}`);
    }) as never);
  });

  it('Disclaimer always shown', async () => {
    renderPage();
    expect(await screen.findByText(/this is guidance, not a diagnosis/i)).toBeInTheDocument();

    vi.mocked(apiClient.POST).mockResolvedValue(
      ok({
        urgent: false,
        emergencyMessage: null,
        redFlags: [],
        matchedSymptoms: [{ symptomId: 'cough', symptomName: 'Cough', source: 'selected' }],
        specializations: [
          { specializationId: 'pulm', specializationName: 'Pulmonology', score: 2, reasons: [] },
        ],
        doctors: [],
        ageUnknown: false,
      }),
    );

    await userEvent.click(await screen.findByRole('button', { name: 'Cough' }));
    await userEvent.click(screen.getByRole('button', { name: /get suggestions/i }));

    expect(await screen.findByText('Pulmonology', { exact: false })).toBeInTheDocument();
    // Still visible after results are shown.
    expect(screen.getByText(/this is guidance, not a diagnosis/i)).toBeInTheDocument();
  });

  it('Urgent result in the page', async () => {
    vi.mocked(apiClient.POST).mockResolvedValue(
      ok({
        urgent: true,
        emergencyMessage: 'This may be a medical emergency. Contact your local emergency services immediately. Symptoms of concern: Chest pain.',
        redFlags: [{ symptomId: 'chest-pain', symptomName: 'Chest pain' }],
        matchedSymptoms: [{ symptomId: 'chest-pain', symptomName: 'Chest pain', source: 'selected' }],
        specializations: [
          { specializationId: 'cardio', specializationName: 'Cardiology', score: 3, reasons: [] },
        ],
        doctors: [
          {
            doctorId: 'doc-1',
            displayName: 'Dr. Heart',
            specializationId: 'cardio',
            score: 3,
            reasons: [{ symptomId: 'chest-pain', symptomName: 'Chest pain', specializationId: 'cardio', specializationName: 'Cardiology', weight: 3, source: 'selected' }],
            nextAvailableSlot: null,
          },
        ],
        ageUnknown: false,
      }),
    );

    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Chest pain' }));
    await userEvent.click(screen.getByRole('button', { name: /get suggestions/i }));

    expect(await screen.findByText(/this may need urgent attention/i)).toBeInTheDocument();
    expect(screen.queryByText('Dr. Heart')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('checkbox', { name: /i have read this warning/i }));

    expect(await screen.findByText('Dr. Heart')).toBeInTheDocument();
  });
});
