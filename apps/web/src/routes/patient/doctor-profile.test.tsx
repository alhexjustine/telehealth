import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { PatientDoctorProfilePage } from './doctor-profile';
import { apiClient } from '@/lib/api-client';

vi.mock('@/lib/api-client', () => ({
  apiClient: { GET: vi.fn(), PUT: vi.fn(), POST: vi.fn(), DELETE: vi.fn() },
}));

const ok = <T,>(data: T) => ({ data, error: undefined, response: { ok: true, status: 200 } as Response });

const PROFILE = {
  id: 'doc-1',
  displayName: 'Dr. Grace Hopper',
  bio: 'Compiler pioneer.',
  specializations: [{ id: 'derm-id', slug: 'dermatology', name: 'Dermatology', description: 'Skin' }],
  yearsOfExperience: 10,
  consultationMinutes: 30,
  timezone: 'UTC',
  acceptingBookings: true,
  averageRating: null,
  reviewCount: 0,
};

const NO_REVIEWS = { items: [], total: 0, page: 1, pageSize: 20, averageRating: null, reviewCount: 0 };

function renderPage() {
  const queryClient = new QueryClient();
  const router = createMemoryRouter(
    [{ path: '/patient/doctors/:doctorId', element: <PatientDoctorProfilePage /> }],
    { initialEntries: ['/patient/doctors/doc-1'] },
  );
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

// Pins the "browser" time zone used by `Intl.DateTimeFormat()` (called with no
// options anywhere resolvedOptions().timeZone is read) so slot grouping and
// formatting are deterministic regardless of the host machine's real zone.
// A plain function (not arrow, not class) so it works whether the app code
// calls it with or without `new` — explicitly returning the real formatter
// makes both invocation styles resolve to the same instance.
const OriginalDateTimeFormat = Intl.DateTimeFormat;
function PinnedTimeZoneDateTimeFormat(locale?: string | string[], options?: Intl.DateTimeFormatOptions) {
  return new OriginalDateTimeFormat(locale, { ...options, timeZone: options?.timeZone ?? 'Asia/Manila' });
}

describe('PatientDoctorProfilePage', () => {
  beforeEach(() => {
    vi.mocked(apiClient.GET).mockReset();
    Intl.DateTimeFormat = PinnedTimeZoneDateTimeFormat as unknown as typeof Intl.DateTimeFormat;
  });

  afterEach(() => {
    Intl.DateTimeFormat = OriginalDateTimeFormat;
  });

  it('Slots shown in patient time', async () => {
    vi.mocked(apiClient.GET).mockImplementation(((path: unknown) => {
      if (path === '/doctors/{doctorId}') return Promise.resolve(ok(PROFILE));
      if (path === '/doctors/{doctorId}/reviews') return Promise.resolve(ok(NO_REVIEWS));
      if (path === '/doctors/{doctorId}/slots') {
        // 09:00 UTC = 17:00 in Asia/Manila (UTC+8).
        return Promise.resolve(ok([{ start: '2026-10-05T09:00:00.000Z', end: '2026-10-05T09:30:00.000Z' }]));
      }
      throw new Error(`unexpected GET ${String(path)}`);
    }) as never);

    renderPage();

    expect(await screen.findByText('5:00 PM')).toBeInTheDocument();
    expect(screen.getByText(/asia\/manila|gmt\+8|\+08:00/i)).toBeInTheDocument();
  });

  it('No availability', async () => {
    vi.mocked(apiClient.GET).mockImplementation(((path: unknown) => {
      if (path === '/doctors/{doctorId}') return Promise.resolve(ok(PROFILE));
      if (path === '/doctors/{doctorId}/reviews') return Promise.resolve(ok(NO_REVIEWS));
      if (path === '/doctors/{doctorId}/slots') return Promise.resolve(ok([]));
      throw new Error(`unexpected GET ${String(path)}`);
    }) as never);

    renderPage();

    expect(await screen.findByText(/no times are available/i)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /other dermatology doctors/i });
    expect(link).toHaveAttribute('href', '/patient/doctors?specialization=dermatology');
  });

  it('Not accepting bookings', async () => {
    vi.mocked(apiClient.GET).mockImplementation(((path: unknown) => {
      if (path === '/doctors/{doctorId}') return Promise.resolve(ok({ ...PROFILE, acceptingBookings: false }));
      if (path === '/doctors/{doctorId}/reviews') return Promise.resolve(ok(NO_REVIEWS));
      if (path === '/doctors/{doctorId}/slots') return Promise.resolve(ok([]));
      throw new Error(`unexpected GET ${String(path)}`);
    }) as never);

    renderPage();

    expect(await screen.findByText(/isn't accepting new bookings right now/i)).toBeInTheDocument();
    expect(screen.queryByText(/no times are available/i)).not.toBeInTheDocument();
  });

  it('Shows the rating summary and visible reviews', async () => {
    vi.mocked(apiClient.GET).mockImplementation(((path: unknown) => {
      if (path === '/doctors/{doctorId}') return Promise.resolve(ok({ ...PROFILE, averageRating: 4.5, reviewCount: 2 }));
      if (path === '/doctors/{doctorId}/reviews') {
        return Promise.resolve(
          ok({
            items: [
              { id: 'rev-1', rating: 5, comment: 'Excellent care', createdAt: '2026-01-01T00:00:00.000Z' },
              { id: 'rev-2', rating: 4, comment: null, createdAt: '2026-01-02T00:00:00.000Z' },
            ],
            total: 2,
            page: 1,
            pageSize: 20,
            averageRating: 4.5,
            reviewCount: 2,
          }),
        );
      }
      if (path === '/doctors/{doctorId}/slots') return Promise.resolve(ok([]));
      throw new Error(`unexpected GET ${String(path)}`);
    }) as never);

    renderPage();

    expect(await screen.findByText('4.5')).toBeInTheDocument();
    expect(screen.getByText(/2 reviews/)).toBeInTheDocument();
    expect(await screen.findByText('Excellent care')).toBeInTheDocument();
  });

  it('Shows "No reviews yet" when there are none', async () => {
    vi.mocked(apiClient.GET).mockImplementation(((path: unknown) => {
      if (path === '/doctors/{doctorId}') return Promise.resolve(ok(PROFILE));
      if (path === '/doctors/{doctorId}/reviews') return Promise.resolve(ok(NO_REVIEWS));
      if (path === '/doctors/{doctorId}/slots') return Promise.resolve(ok([]));
      throw new Error(`unexpected GET ${String(path)}`);
    }) as never);

    renderPage();

    expect(await screen.findAllByText('No reviews yet')).not.toHaveLength(0);
  });
});
