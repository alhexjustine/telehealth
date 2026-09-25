import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
          isPending: false,
        };
      }
      return { data: { items: [], total: 0, page: 1, pageSize: 20 }, isPending: false };
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
});
