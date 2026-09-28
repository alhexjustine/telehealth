import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { PatientFavoritesPage } from './favorites';
import { apiClient } from '@/lib/api-client';

vi.mock('@/lib/api-client', () => ({
  apiClient: { GET: vi.fn(), POST: vi.fn(), DELETE: vi.fn() },
}));

const ok = <T,>(data: T) => ({ data, error: undefined, response: { ok: true, status: 200 } as Response });

const GRACE = {
  id: 'doc-1',
  displayName: 'Dr. Grace Hopper',
  specializations: [{ id: 'derm-id', name: 'Dermatology' }],
  bioExcerpt: 'A great doctor',
  yearsOfExperience: 10,
  consultationMinutes: 30,
  acceptingBookings: true,
  nextAvailableSlot: '2026-10-05T09:00:00.000Z',
  averageRating: 4.8,
  reviewCount: 5,
  favoritedAt: '2026-09-01T00:00:00.000Z',
};

function renderPage() {
  const queryClient = new QueryClient();
  const router = createMemoryRouter([{ path: '/patient/favorites', element: <PatientFavoritesPage /> }], {
    initialEntries: ['/patient/favorites'],
  });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('PatientFavoritesPage', () => {
  it('Empty favorites', async () => {
    vi.mocked(apiClient.GET).mockImplementation(((path: unknown) => {
      if (path === '/patients/me/favorites') return Promise.resolve(ok({ items: [] }));
      throw new Error(`unexpected GET ${String(path)}`);
    }) as never);

    renderPage();

    expect(await screen.findByText(/haven't favorited any doctors yet/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /find a doctor/i })).toHaveAttribute('href', '/patient/doctors');
  });

  it('Book from My favorites skips search', async () => {
    vi.mocked(apiClient.GET).mockImplementation(((path: unknown) => {
      if (path === '/patients/me/favorites') return Promise.resolve(ok({ items: [GRACE] }));
      throw new Error(`unexpected GET ${String(path)}`);
    }) as never);

    renderPage();

    expect(await screen.findByText('Dr. Grace Hopper')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^book$/i })).toHaveAttribute('href', '/patient/doctors/doc-1');
  });

  it('Unfavorite from My favorites', async () => {
    let items = [GRACE];
    vi.mocked(apiClient.GET).mockImplementation(((path: unknown) => {
      if (path === '/patients/me/favorites') return Promise.resolve(ok({ items }));
      throw new Error(`unexpected GET ${String(path)}`);
    }) as never);
    vi.mocked(apiClient.DELETE).mockImplementation(((path: unknown) => {
      if (path === '/patients/me/favorites/{doctorId}') {
        items = [];
        return Promise.resolve({ error: undefined, response: { ok: true, status: 204 } as Response });
      }
      throw new Error(`unexpected DELETE ${String(path)}`);
    }) as never);

    renderPage();

    await screen.findByText('Dr. Grace Hopper');
    await userEvent.click(screen.getByRole('button', { name: /remove from favorites/i }));

    await waitFor(() => expect(apiClient.DELETE).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText('Dr. Grace Hopper')).not.toBeInTheDocument());
    expect(await screen.findByText(/haven't favorited any doctors yet/i)).toBeInTheDocument();
  });
});
