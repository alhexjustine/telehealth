import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PatientAppointmentsPage } from './appointments';
import { useAppointments, useCancelAppointment, useRescheduleAppointment } from '@/lib/appointments/use-appointments';
import { useDoctorSlots } from '@/lib/availability/use-availability';

vi.mock('@/lib/appointments/use-appointments', () => ({
  useAppointments: vi.fn(),
  useCancelAppointment: vi.fn(),
  useRescheduleAppointment: vi.fn(),
}));
vi.mock('@/lib/availability/use-availability', () => ({ useDoctorSlots: vi.fn() }));

function renderPage() {
  const queryClient = new QueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <PatientAppointmentsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('PatientAppointmentsPage', () => {
  it('Reschedule disabled near start', () => {
    const inOneHour = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    vi.mocked(useAppointments).mockImplementation(((scope: string) => {
      if (scope === 'upcoming') {
        return {
          data: {
            items: [
              {
                id: 'apt-1',
                startsAt: inOneHour,
                endsAt: new Date(new Date(inOneHour).getTime() + 30 * 60_000).toISOString(),
                status: 'BOOKED',
                reason: 'Starts soon',
                doctor: { id: 'doc-1', displayName: 'Dr. Grace Hopper', specializations: [] },
                patient: { id: 'pat-1', displayName: 'Ada Lovelace', age: 30 },
                symptoms: [],
                cancelledAt: null,
                cancellationReason: null,
                cancelledByRole: null,
                rescheduledFromId: null,
              },
            ],
            total: 1,
            page: 1,
            pageSize: 20,
          },
          status: 'success',
          error: null,
          refetch: vi.fn(),
          isPending: false,
        };
      }
      return {
        data: { items: [], total: 0, page: 1, pageSize: 20 },
        status: 'success',
        error: null,
        refetch: vi.fn(),
        isPending: false,
      };
    }) as never);
    vi.mocked(useCancelAppointment).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
    vi.mocked(useRescheduleAppointment).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
    vi.mocked(useDoctorSlots).mockReturnValue({ data: [], isPending: false } as never);

    renderPage();

    const rescheduleButton = screen.getByRole('button', { name: /reschedule/i });
    expect(rescheduleButton).toBeDisabled();
    expect(rescheduleButton).toHaveAttribute(
      'title',
      expect.stringMatching(/closes 2 hours before the appointment starts/i),
    );

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    expect(cancelButton).not.toBeDisabled();
  });

  it('Empty list', () => {
    vi.mocked(useAppointments).mockReturnValue({
      data: { items: [], total: 0, page: 1, pageSize: 20 },
      status: 'success',
      error: null,
      refetch: vi.fn(),
      isPending: false,
    } as never);
    vi.mocked(useCancelAppointment).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
    vi.mocked(useRescheduleAppointment).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
    vi.mocked(useDoctorSlots).mockReturnValue({ data: [], isPending: false } as never);

    renderPage();

    expect(screen.getByText(/don't have any upcoming appointments yet/i)).toBeInTheDocument();
    const findCareLink = screen.getByRole('link', { name: /find care/i });
    expect(findCareLink).toHaveAttribute('href', '/patient/find-care');
  });

  it('Book again preselects the same attendee', () => {
    const inThreeHours = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
    vi.mocked(useAppointments).mockImplementation(((scope: string) => {
      if (scope === 'upcoming') {
        return {
          data: {
            items: [
              {
                id: 'apt-1',
                startsAt: inThreeHours,
                endsAt: new Date(new Date(inThreeHours).getTime() + 30 * 60_000).toISOString(),
                status: 'BOOKED',
                reason: 'Follow-up',
                doctor: { id: 'doc-1', displayName: 'Dr. Grace Hopper', specializations: [] },
                patient: { id: 'pat-1', displayName: 'Ada Lovelace', age: 30 },
                dependent: { id: 'dep-1', displayName: 'Jamie Lovelace', relationship: 'CHILD' },
                symptoms: [],
                cancelledAt: null,
                cancellationReason: null,
                cancelledByRole: null,
                rescheduledFromId: null,
              },
            ],
            total: 1,
            page: 1,
            pageSize: 20,
          },
          status: 'success',
          error: null,
          refetch: vi.fn(),
          isPending: false,
        };
      }
      return {
        data: { items: [], total: 0, page: 1, pageSize: 20 },
        status: 'success',
        error: null,
        refetch: vi.fn(),
        isPending: false,
      };
    }) as never);
    vi.mocked(useCancelAppointment).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
    vi.mocked(useRescheduleAppointment).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
    vi.mocked(useDoctorSlots).mockReturnValue({ data: [], isPending: false } as never);

    renderPage();

    const bookAgainLink = screen.getByRole('link', { name: /book again/i });
    expect(bookAgainLink).toHaveAttribute('href', '/patient/doctors/doc-1?dependent=dep-1');
  });
  it('Pages through appointments five at a time', async () => {
    const item = {
      id: 'apt-1',
      startsAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      endsAt: new Date(Date.now() + 49 * 60 * 60 * 1000).toISOString(),
      status: 'BOOKED',
      reason: 'Checkup',
      doctor: { id: 'doc-1', displayName: 'Dr. Grace Hopper', specializations: [] },
      patient: { id: 'pat-1', displayName: 'Ada Lovelace', age: 30 },
      symptoms: [],
      cancelledAt: null,
      cancellationReason: null,
      cancelledByRole: null,
      rescheduledFromId: null,
    };
    vi.mocked(useAppointments).mockImplementation(((_scope: string, page: number) => ({
      data: { items: [item], total: 12, page, pageSize: 5 },
      status: 'success',
      error: null,
      refetch: vi.fn(),
      isPending: false,
    })) as never);
    vi.mocked(useCancelAppointment).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
    vi.mocked(useRescheduleAppointment).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
    vi.mocked(useDoctorSlots).mockReturnValue({ data: [], isPending: false } as never);

    renderPage();

    expect(useAppointments).toHaveBeenCalledWith('upcoming', 1, 5);
    expect(screen.getByText(/page 1 of 3/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /next/i }));

    expect(useAppointments).toHaveBeenLastCalledWith('past', 1, 5);
    expect(useAppointments).toHaveBeenCalledWith('upcoming', 2, 5);
    expect(screen.getByText(/page 2 of 3/i)).toBeInTheDocument();
  });
});
