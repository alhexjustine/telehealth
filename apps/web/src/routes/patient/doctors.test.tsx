import { beforeEach, describe, expect, it } from 'vitest';
import { vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { addDays, format, startOfDay } from 'date-fns';
import { FindDoctorPage } from './doctors';
import { apiClient } from '@/lib/api-client';

vi.mock('@/lib/api-client', () => ({
  apiClient: { GET: vi.fn(), PUT: vi.fn(), POST: vi.fn(), DELETE: vi.fn() },
}));

const ok = <T,>(data: T) => ({ data, error: undefined, response: { ok: true, status: 200 } as Response });

const SPECIALIZATIONS = [
  { id: 'derm-id', slug: 'dermatology', name: 'Dermatology', description: 'Skin' },
  { id: 'cardio-id', slug: 'cardiology', name: 'Cardiology', description: 'Heart' },
];

function doctorResult(
  overrides: Partial<{
    id: string;
    displayName: string;
    specializations: unknown[];
    acceptingBookings: boolean;
    nextAvailableSlot: string | null;
    averageRating: number | null;
    reviewCount: number;
  }> = {},
) {
  return {
    id: 'doc-1',
    displayName: 'Dr. Grace Hopper',
    specializations: [{ id: 'derm-id', name: 'Dermatology' }],
    bioExcerpt: 'A great doctor',
    yearsOfExperience: 10,
    consultationMinutes: 30,
    acceptingBookings: true,
    nextAvailableSlot: '2026-10-05T09:00:00.000Z',
    averageRating: null,
    reviewCount: 0,
    ...overrides,
  };
}

function renderPage(initialPath = '/patient/doctors') {
  const queryClient = new QueryClient();
  const router = createMemoryRouter([{ path: '/patient/doctors', element: <FindDoctorPage /> }], {
    initialEntries: [initialPath],
  });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

describe('FindDoctorPage', () => {
  beforeEach(() => {
    vi.mocked(apiClient.GET).mockReset();
  });

  it('Filter from the page', async () => {
    let lastQuery: Record<string, unknown> | undefined;
    vi.mocked(apiClient.GET).mockImplementation(((path: unknown, options?: { params?: { query?: Record<string, unknown> } }) => {
      if (path === '/specializations') return Promise.resolve(ok(SPECIALIZATIONS));
      if (path === '/patients/me/favorites') return Promise.resolve(ok({ items: [] }));
      if (path === '/doctors') {
        lastQuery = options?.params?.query;
        const specialization = options?.params?.query?.specialization;
        const items = specialization === 'dermatology' ? [doctorResult()] : [doctorResult(), doctorResult({ id: 'doc-2', displayName: 'Dr. Cardio', specializations: [{ id: 'cardio-id', name: 'Cardiology' }] })];
        return Promise.resolve(ok({ items, total: items.length, page: 1, pageSize: 12 }));
      }
      throw new Error(`unexpected GET ${String(path)}`);
    }) as never);

    const router = renderPage();

    await screen.findByText('Dr. Grace Hopper');
    expect(screen.getByText('Dr. Cardio')).toBeInTheDocument();

    const specializationSelect = screen.getByLabelText(/specialization/i);
    await userEvent.selectOptions(specializationSelect, 'dermatology');

    await waitFor(() => expect(router.state.location.search).toContain('specialization=dermatology'));
    await waitFor(() => expect(lastQuery?.specialization).toBe('dermatology'));
    await waitFor(() => expect(screen.queryByText('Dr. Cardio')).not.toBeInTheDocument());
    expect(screen.getByText('Dr. Grace Hopper')).toBeInTheDocument();
  });

  it('Search as you type', async () => {
    let lastQuery: Record<string, unknown> | undefined;
    vi.mocked(apiClient.GET).mockImplementation(((path: unknown, options?: { params?: { query?: Record<string, unknown> } }) => {
      if (path === '/specializations') return Promise.resolve(ok(SPECIALIZATIONS));
      if (path === '/patients/me/favorites') return Promise.resolve(ok({ items: [] }));
      if (path === '/doctors') {
        lastQuery = options?.params?.query;
        return Promise.resolve(ok({ items: [doctorResult()], total: 1, page: 1, pageSize: 12 }));
      }
      throw new Error(`unexpected GET ${String(path)}`);
    }) as never);

    const router = renderPage();
    await screen.findByText('Dr. Grace Hopper');
    expect(screen.queryByRole('button', { name: /^search$/i })).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Search'), 'Hopper');

    await waitFor(() => expect(router.state.location.search).toContain('q=Hopper'));
    await waitFor(() => expect(lastQuery?.q).toBe('Hopper'));
  });

  it('Pick an availability range', async () => {
    let lastQuery: Record<string, unknown> | undefined;
    vi.mocked(apiClient.GET).mockImplementation(((path: unknown, options?: { params?: { query?: Record<string, unknown> } }) => {
      if (path === '/specializations') return Promise.resolve(ok(SPECIALIZATIONS));
      if (path === '/patients/me/favorites') return Promise.resolve(ok({ items: [] }));
      if (path === '/doctors') {
        lastQuery = options?.params?.query;
        return Promise.resolve(ok({ items: [doctorResult()], total: 1, page: 1, pageSize: 12 }));
      }
      throw new Error(`unexpected GET ${String(path)}`);
    }) as never);

    const router = renderPage();
    await screen.findByText('Dr. Grace Hopper');
    expect(lastQuery?.availableFrom).toBeUndefined();

    const today = new Date();
    const tomorrow = addDays(today, 1);
    await userEvent.click(screen.getByRole('button', { name: 'Available on Any day' }));
    await userEvent.click(await screen.findByRole('button', { name: new RegExp(format(today, 'MMMM do')) }));
    if (tomorrow.getMonth() !== today.getMonth()) {
      await userEvent.click(screen.getByRole('button', { name: /next month/i }));
    }
    await userEvent.click(screen.getByRole('button', { name: new RegExp(format(tomorrow, 'MMMM do')) }));
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(() =>
      expect(router.state.location.search).toBe(
        `?from=${format(today, 'yyyy-MM-dd')}&to=${format(tomorrow, 'yyyy-MM-dd')}`,
      ),
    );
    await waitFor(() => expect(lastQuery?.availableTo).toBe(startOfDay(addDays(today, 2)).toISOString()));
    expect(typeof lastQuery?.availableFrom).toBe('string');
    expect(
      screen.getByRole('button', { name: `Available on ${format(today, 'MMM d')} – ${format(tomorrow, 'MMM d')}` }),
    ).toBeInTheDocument();
  });

  it('restores an availability range from the URL, and a single day with Apply', async () => {
    let lastQuery: Record<string, unknown> | undefined;
    vi.mocked(apiClient.GET).mockImplementation(((path: unknown, options?: { params?: { query?: Record<string, unknown> } }) => {
      if (path === '/specializations') return Promise.resolve(ok(SPECIALIZATIONS));
      if (path === '/patients/me/favorites') return Promise.resolve(ok({ items: [] }));
      if (path === '/doctors') {
        lastQuery = options?.params?.query;
        return Promise.resolve(ok({ items: [doctorResult()], total: 1, page: 1, pageSize: 12 }));
      }
      throw new Error(`unexpected GET ${String(path)}`);
    }) as never);
    const today = new Date();
    const inThreeDays = addDays(today, 3);

    const router = renderPage(`/patient/doctors?from=${format(today, 'yyyy-MM-dd')}&to=${format(inThreeDays, 'yyyy-MM-dd')}`);
    await screen.findByText('Dr. Grace Hopper');
    expect(lastQuery?.availableTo).toBe(startOfDay(addDays(today, 4)).toISOString());

    await userEvent.click(
      screen.getByRole('button', { name: `Available on ${format(today, 'MMM d')} – ${format(inThreeDays, 'MMM d')}` }),
    );
    await userEvent.click(await screen.findByRole('button', { name: new RegExp(format(today, 'MMMM do')) }));
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));

    const todayParam = format(today, 'yyyy-MM-dd');
    await waitFor(() => expect(router.state.location.search).toBe(`?from=${todayParam}&to=${todayParam}`));
    expect(screen.getByRole('button', { name: `Available on ${format(today, 'EEE, MMM d')}` })).toBeInTheDocument();
  });

  it('shows a "Not accepting bookings" chip instead of a next-available time', async () => {
    vi.mocked(apiClient.GET).mockImplementation(((path: unknown) => {
      if (path === '/specializations') return Promise.resolve(ok(SPECIALIZATIONS));
      if (path === '/patients/me/favorites') return Promise.resolve(ok({ items: [] }));
      if (path === '/doctors') {
        return Promise.resolve(
          ok({
            items: [doctorResult({ acceptingBookings: false, nextAvailableSlot: null })],
            total: 1,
            page: 1,
            pageSize: 12,
          }),
        );
      }
      throw new Error(`unexpected GET ${String(path)}`);
    }) as never);

    renderPage();

    expect(await screen.findByText('Not accepting bookings')).toBeInTheDocument();
    expect(screen.queryByText('Next available')).not.toBeInTheDocument();
  });

  it('Card shows rating', async () => {
    vi.mocked(apiClient.GET).mockImplementation(((path: unknown) => {
      if (path === '/specializations') return Promise.resolve(ok(SPECIALIZATIONS));
      if (path === '/patients/me/favorites') return Promise.resolve(ok({ items: [] }));
      if (path === '/doctors') {
        return Promise.resolve(
          ok({ items: [doctorResult({ averageRating: 4.7, reviewCount: 12 })], total: 1, page: 1, pageSize: 12 }),
        );
      }
      throw new Error(`unexpected GET ${String(path)}`);
    }) as never);

    renderPage();

    await screen.findByText('Dr. Grace Hopper');
    expect(screen.getByText('4.7')).toBeInTheDocument();
    expect(screen.getByText(/12 reviews/)).toBeInTheDocument();
  });

  it('Card shows no-reviews state', async () => {
    vi.mocked(apiClient.GET).mockImplementation(((path: unknown) => {
      if (path === '/specializations') return Promise.resolve(ok(SPECIALIZATIONS));
      if (path === '/patients/me/favorites') return Promise.resolve(ok({ items: [] }));
      if (path === '/doctors') {
        return Promise.resolve(
          ok({ items: [doctorResult({ averageRating: null, reviewCount: 0 })], total: 1, page: 1, pageSize: 12 }),
        );
      }
      throw new Error(`unexpected GET ${String(path)}`);
    }) as never);

    renderPage();

    await screen.findByText('Dr. Grace Hopper');
    expect(screen.getByText('No reviews yet')).toBeInTheDocument();
  });

  it('Sorts by highest rated', async () => {
    let lastQuery: Record<string, unknown> | undefined;
    vi.mocked(apiClient.GET).mockImplementation(((path: unknown, options?: { params?: { query?: Record<string, unknown> } }) => {
      if (path === '/specializations') return Promise.resolve(ok(SPECIALIZATIONS));
      if (path === '/patients/me/favorites') return Promise.resolve(ok({ items: [] }));
      if (path === '/doctors') {
        lastQuery = options?.params?.query;
        return Promise.resolve(ok({ items: [doctorResult()], total: 1, page: 1, pageSize: 12 }));
      }
      throw new Error(`unexpected GET ${String(path)}`);
    }) as never);

    const router = renderPage();
    await screen.findByText('Dr. Grace Hopper');

    await userEvent.selectOptions(screen.getByLabelText(/sort by/i), 'Highest rated');

    await waitFor(() => expect(router.state.location.search).toContain('sort=rating'));
    await waitFor(() => expect(lastQuery?.sort).toBe('rating'));
  });

  it('Favorite from a search result card', async () => {
    let favorites: { id: string }[] = [];
    vi.mocked(apiClient.GET).mockImplementation(((path: unknown) => {
      if (path === '/specializations') return Promise.resolve(ok(SPECIALIZATIONS));
      if (path === '/patients/me/favorites') return Promise.resolve(ok({ items: favorites }));
      if (path === '/doctors') return Promise.resolve(ok({ items: [doctorResult()], total: 1, page: 1, pageSize: 12 }));
      throw new Error(`unexpected GET ${String(path)}`);
    }) as never);
    vi.mocked(apiClient.POST).mockImplementation(((path: unknown, options?: { body?: { doctorId: string } }) => {
      if (path === '/patients/me/favorites') {
        favorites = [{ id: options?.body?.doctorId ?? '' }];
        return Promise.resolve(ok({ doctorId: options?.body?.doctorId, favoritedAt: '2026-09-28T00:00:00.000Z' }));
      }
      throw new Error(`unexpected POST ${String(path)}`);
    }) as never);

    renderPage();

    await screen.findByText('Dr. Grace Hopper');
    const favoriteButton = screen.getByRole('button', { name: /add to favorites/i });
    await userEvent.click(favoriteButton);

    await waitFor(() => expect(apiClient.POST).toHaveBeenCalledWith('/patients/me/favorites', { body: { doctorId: 'doc-1' } }));
    await waitFor(() => expect(screen.getByRole('button', { name: /remove from favorites/i })).toBeInTheDocument());
  });

  it('Favorites only shows just the favorited doctors and ignores server pagination', async () => {
    vi.mocked(apiClient.GET).mockImplementation(((path: unknown) => {
      if (path === '/specializations') return Promise.resolve(ok(SPECIALIZATIONS));
      if (path === '/patients/me/favorites') {
        return Promise.resolve(
          ok({ items: [doctorResult({ id: 'doc-2', displayName: 'Dr. Cardio', specializations: [{ id: 'cardio-id', name: 'Cardiology' }] })] }),
        );
      }
      if (path === '/doctors') {
        return Promise.resolve(
          ok({ items: [doctorResult(), doctorResult({ id: 'doc-2', displayName: 'Dr. Cardio' })], total: 2, page: 1, pageSize: 12 }),
        );
      }
      throw new Error(`unexpected GET ${String(path)}`);
    }) as never);

    const router = renderPage();

    await screen.findByText('Dr. Grace Hopper');
    expect(screen.getByText('Dr. Cardio')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('checkbox', { name: /favorites/i }));

    await waitFor(() => expect(router.state.location.search).toContain('favoritesOnly=true'));
    await waitFor(() => expect(screen.queryByText('Dr. Grace Hopper')).not.toBeInTheDocument());
    expect(screen.getByText('Dr. Cardio')).toBeInTheDocument();
  });

  it('Favorites only respects the specialization filter', async () => {
    vi.mocked(apiClient.GET).mockImplementation(((path: unknown) => {
      if (path === '/specializations') return Promise.resolve(ok(SPECIALIZATIONS));
      if (path === '/patients/me/favorites') {
        return Promise.resolve(
          ok({
            items: [
              doctorResult({ specializations: [{ id: 'derm-id', name: 'Dermatology' }] }),
              doctorResult({ id: 'doc-2', displayName: 'Dr. Cardio', specializations: [{ id: 'cardio-id', name: 'Cardiology' }] }),
            ],
          }),
        );
      }
      if (path === '/doctors') return Promise.resolve(ok({ items: [], total: 0, page: 1, pageSize: 12 }));
      throw new Error(`unexpected GET ${String(path)}`);
    }) as never);

    renderPage('/patient/doctors?favoritesOnly=true');

    await screen.findByText('Dr. Grace Hopper');
    expect(screen.getByText('Dr. Cardio')).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText(/specialization/i), 'cardiology');

    await waitFor(() => expect(screen.queryByText('Dr. Grace Hopper')).not.toBeInTheDocument());
    expect(screen.getByText('Dr. Cardio')).toBeInTheDocument();
  });

  it('Unfavorite while filtering to favorites', async () => {
    let favorites = [doctorResult()];
    vi.mocked(apiClient.GET).mockImplementation(((path: unknown) => {
      if (path === '/specializations') return Promise.resolve(ok(SPECIALIZATIONS));
      if (path === '/patients/me/favorites') return Promise.resolve(ok({ items: favorites }));
      if (path === '/doctors') return Promise.resolve(ok({ items: [], total: 0, page: 1, pageSize: 12 }));
      throw new Error(`unexpected GET ${String(path)}`);
    }) as never);
    vi.mocked(apiClient.DELETE).mockImplementation((() => {
      favorites = [];
      return Promise.resolve({ data: undefined, error: undefined, response: { ok: true, status: 204 } as Response });
    }) as never);

    renderPage('/patient/doctors?favoritesOnly=true');

    await screen.findByText('Dr. Grace Hopper');
    await userEvent.click(screen.getByRole('button', { name: /remove from favorites/i }));

    await waitFor(() => expect(apiClient.DELETE).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText('Dr. Grace Hopper')).not.toBeInTheDocument());
  });

  it('Book from a favorited doctor\'s card', async () => {
    vi.mocked(apiClient.GET).mockImplementation(((path: unknown) => {
      if (path === '/specializations') return Promise.resolve(ok(SPECIALIZATIONS));
      if (path === '/patients/me/favorites') return Promise.resolve(ok({ items: [doctorResult()] }));
      if (path === '/doctors') return Promise.resolve(ok({ items: [], total: 0, page: 1, pageSize: 12 }));
      throw new Error(`unexpected GET ${String(path)}`);
    }) as never);

    renderPage('/patient/doctors?favoritesOnly=true');

    await screen.findByText('Dr. Grace Hopper');
    expect(screen.getByRole('link', { name: /dr\. grace hopper/i })).toHaveAttribute(
      'href',
      '/patient/doctors/doc-1',
    );
  });

  it('No results', async () => {
    vi.mocked(apiClient.GET).mockImplementation(((path: unknown) => {
      if (path === '/specializations') return Promise.resolve(ok(SPECIALIZATIONS));
      if (path === '/patients/me/favorites') return Promise.resolve(ok({ items: [] }));
      if (path === '/doctors') return Promise.resolve(ok({ items: [], total: 0, page: 1, pageSize: 12 }));
      throw new Error(`unexpected GET ${String(path)}`);
    }) as never);

    renderPage();

    expect(await screen.findByText(/no doctors match your search/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /guided symptom matching/i })).toHaveAttribute(
      'href',
      '/patient/find-care',
    );
  });
});
