import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PatientDependentsPage } from './dependents';
import { apiClient } from '@/lib/api-client';

vi.mock('@/lib/api-client', () => ({
  apiClient: { GET: vi.fn(), POST: vi.fn(), PUT: vi.fn(), PATCH: vi.fn(), DELETE: vi.fn() },
}));

const ok = <T,>(data: T) => ({ data, error: undefined, response: { ok: true, status: 200 } as Response });

const JAMIE = {
  id: 'dep-1',
  firstName: 'Jamie',
  lastName: 'Lovelace',
  birthDate: '2018-06-15',
  relationship: 'CHILD',
  medicalConditions: null,
  allergies: null,
  currentMedications: null,
};

function renderPage() {
  const queryClient = new QueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <PatientDependentsPage />
    </QueryClientProvider>,
  );
}

describe('PatientDependentsPage', () => {
  it('Add from the web app', async () => {
    let dependents: (typeof JAMIE)[] = [];
    vi.mocked(apiClient.GET).mockImplementation(((path: unknown) => {
      if (path === '/patients/me/dependents') return Promise.resolve(ok({ items: dependents }));
      throw new Error(`unexpected GET ${String(path)}`);
    }) as never);
    vi.mocked(apiClient.POST).mockImplementation(((path: unknown) => {
      if (path === '/patients/me/dependents') {
        dependents = [JAMIE];
        return Promise.resolve(ok(JAMIE));
      }
      throw new Error(`unexpected POST ${String(path)}`);
    }) as never);

    renderPage();

    expect(await screen.findByText(/haven't added any dependents/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /add dependent/i }));
    await userEvent.type(screen.getByLabelText(/first name/i), 'Jamie');
    await userEvent.type(screen.getByLabelText(/last name/i), 'Lovelace');
    await userEvent.click(screen.getByLabelText(/^birthdate$/i));
    await userEvent.click(await screen.findByRole('button', { name: /birthdate previous years/i }));
    await userEvent.click(await screen.findByRole('button', { name: '2018' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Jun' }));
    await userEvent.click(await screen.findByRole('button', { name: '15' }));
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(apiClient.POST).toHaveBeenCalled());
    expect(await screen.findByText('Jamie Lovelace')).toBeInTheDocument();
  });

  it('Remove confirmation', async () => {
    vi.mocked(apiClient.GET).mockImplementation(((path: unknown) => {
      if (path === '/patients/me/dependents') return Promise.resolve(ok({ items: [JAMIE] }));
      throw new Error(`unexpected GET ${String(path)}`);
    }) as never);
    const deleteMock = vi.fn().mockResolvedValue(ok(JAMIE));
    vi.mocked(apiClient.DELETE).mockImplementation(deleteMock as never);

    renderPage();

    expect(await screen.findByText('Jamie Lovelace')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /remove/i }));

    expect(await screen.findByText(/remove jamie lovelace\?/i)).toBeInTheDocument();
    expect(deleteMock).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: /^remove$/i }));
    await waitFor(() => expect(deleteMock).toHaveBeenCalled());
  });
});
