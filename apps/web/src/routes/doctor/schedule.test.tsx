import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DoctorSchedulePage } from './schedule';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import { useDoctorProfile } from '@/lib/doctors/use-doctor-profile';
import { apiClient } from '@/lib/api-client';

vi.mock('@/lib/auth/use-current-user', () => ({ useCurrentUser: vi.fn() }));
vi.mock('@/lib/doctors/use-doctor-profile', () => ({ useDoctorProfile: vi.fn() }));
vi.mock('@/lib/api-client', () => ({
  apiClient: { GET: vi.fn(), PUT: vi.fn(), POST: vi.fn(), DELETE: vi.fn() },
}));

function renderSchedulePage() {
  const queryClient = new QueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DoctorSchedulePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const ok = <T,>(data: T) => ({ data, error: undefined, response: { ok: true, status: 200 } as Response });
const err = (error: unknown, status = 409) => ({
  data: undefined,
  error,
  response: { ok: false, status } as Response,
});

describe('DoctorSchedulePage', () => {
  beforeEach(() => {
    vi.mocked(useCurrentUser).mockReturnValue({
      data: { id: 'doctor-1', email: 'd@example.com', role: 'DOCTOR', status: 'ACTIVE', displayName: 'Dr. D' },
    } as never);
    vi.mocked(useDoctorProfile).mockReturnValue({
      data: { consultationMinutes: 30 },
      isPending: false,
    } as never);
    vi.mocked(apiClient.GET).mockReset();
    vi.mocked(apiClient.PUT).mockReset();
  });

  it('Inline range errors', async () => {
    const getImpl = (path: unknown) => {
      if (path === '/doctors/me/availability') {
        return ok({
          timezone: 'Asia/Manila',
          rules: [
            { weekday: 1, startMinute: 9 * 60, endMinute: 12 * 60 },
            { weekday: 1, startMinute: 11 * 60, endMinute: 14 * 60 },
          ],
          timeOff: [],
        });
      }
      if (path === '/doctors/{doctorId}/slots') {
        return ok([]);
      }
      throw new Error(`unexpected GET ${String(path)}`);
    };
    vi.mocked(apiClient.GET).mockImplementation(getImpl as never);

    renderSchedulePage();

    const saveButton = await screen.findByRole('button', { name: /save schedule/i });
    await userEvent.click(saveButton);

    const alerts = await screen.findAllByText(/overlaps another range/i);
    expect(alerts).toHaveLength(2);
    expect(apiClient.PUT).not.toHaveBeenCalled();
  });

  it('Preview updates after saving', async () => {
    let slotsCallCount = 0;
    const getImpl = (path: unknown) => {
      if (path === '/doctors/me/availability') {
        return ok({ timezone: 'Asia/Manila', rules: [], timeOff: [] });
      }
      if (path === '/doctors/{doctorId}/slots') {
        slotsCallCount += 1;
        if (slotsCallCount === 1) return ok([]);
        return ok([{ start: '2026-10-05T09:00:00.000Z', end: '2026-10-05T09:30:00.000Z' }]);
      }
      throw new Error(`unexpected GET ${String(path)}`);
    };
    vi.mocked(apiClient.GET).mockImplementation(getImpl as never);
    vi.mocked(apiClient.PUT).mockResolvedValue(
      ok({
        timezone: 'Asia/Manila',
        rules: [{ weekday: 1, startMinute: 9 * 60, endMinute: 10 * 60 }],
        timeOff: [],
      }),
    );

    renderSchedulePage();

    expect(await screen.findByText(/no upcoming slots/i)).toBeInTheDocument();

    const addRangeButtons = await screen.findAllByRole('button', { name: /add range/i });
    await userEvent.click(addRangeButtons[0]!); // Monday

    const saveButton = screen.getByRole('button', { name: /save schedule/i });
    await userEvent.click(saveButton);

    await waitFor(() => expect(apiClient.PUT).toHaveBeenCalledTimes(1));
    // 09:00 UTC is 5:00 PM in Asia/Manila (UTC+8) — scoped to the "Next 7 days"
    // preview card, since the range-editor selects also contain "17:00".
    const previewCard = screen.getByTestId('slot-preview-card');
    await waitFor(() => expect(previewCard).toHaveTextContent('5:00 PM'));
  });

  it('Schedule change would orphan a booking: shows the conflicting appointments', async () => {
    const getImpl = (path: unknown) => {
      if (path === '/doctors/me/availability') {
        return ok({
          timezone: 'UTC',
          rules: [{ weekday: 1, startMinute: 9 * 60, endMinute: 17 * 60 }],
          timeOff: [],
        });
      }
      if (path === '/doctors/{doctorId}/slots') return ok([]);
      throw new Error(`unexpected GET ${String(path)}`);
    };
    vi.mocked(apiClient.GET).mockImplementation(getImpl as never);
    vi.mocked(apiClient.PUT).mockResolvedValue(
      err({
        statusCode: 409,
        error: 'Conflict',
        message: 'This change conflicts with one or more of your booked appointments.',
        requestId: 'req-1',
        code: 'SCHEDULE_CONFLICTS_WITH_BOOKINGS',
        details: {
          appointments: [
            {
              id: 'apt-1',
              startsAt: '2026-10-05T09:00:00.000Z',
              endsAt: '2026-10-05T09:30:00.000Z',
              patientName: 'Ada Lovelace',
            },
          ],
        },
      }),
    );

    renderSchedulePage();

    const saveButton = await screen.findByRole('button', { name: /save schedule/i });
    await userEvent.click(saveButton);

    const alert = await screen.findByTestId('schedule-conflicts');
    expect(alert).toHaveTextContent('Ada Lovelace');
    const link = screen.getByRole('link', { name: /ada lovelace/i });
    expect(link).toHaveAttribute('href', '/doctor/appointments/apt-1');
  });
});
