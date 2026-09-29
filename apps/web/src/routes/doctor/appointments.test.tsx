import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DoctorAppointmentsPage } from './appointments';
import {
  useAppointments,
  useCancelAppointment,
  useRebookAppointment,
  useRescheduleAppointment,
} from '@/lib/appointments/use-appointments';
import { useDoctorSlots } from '@/lib/availability/use-availability';

vi.mock('@/lib/appointments/use-appointments', () => ({
  useAppointments: vi.fn(),
  useCancelAppointment: vi.fn(),
  useRebookAppointment: vi.fn(),
  useRescheduleAppointment: vi.fn(),
}));
vi.mock('@/lib/availability/use-availability', () => ({ useDoctorSlots: vi.fn() }));

function appointment(startsAt: string, status = 'BOOKED') {
  return {
    id: 'apt-1',
    startsAt,
    endsAt: new Date(new Date(startsAt).getTime() + 30 * 60_000).toISOString(),
    status,
    reason: 'Follow-up on results',
    doctor: { id: 'doc-1', displayName: 'Dr. Grace Hopper', specializations: [] },
    patient: { id: 'pat-1', displayName: 'Ada Lovelace', age: 30 },
    dependent: null,
    symptoms: [],
    cancelledAt: null,
    cancellationReason: null,
    cancelledByRole: null,
    rescheduledFromId: null,
  };
}

function setup(startsAt: string, status = 'BOOKED') {
  const rebookMutate = vi.fn().mockResolvedValue({});
  const rescheduleMutate = vi.fn().mockResolvedValue({});
  vi.mocked(useAppointments).mockImplementation(((scope: string) => ({
    data: {
      items: scope === 'upcoming' ? [appointment(startsAt, status)] : [],
      total: scope === 'upcoming' ? 1 : 0,
      page: 1,
      pageSize: 5,
    },
    status: 'success',
    error: null,
    refetch: vi.fn(),
    isPending: false,
  })) as never);
  vi.mocked(useCancelAppointment).mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
  } as never);
  vi.mocked(useRebookAppointment).mockReturnValue({
    mutateAsync: rebookMutate,
    isPending: false,
  } as never);
  vi.mocked(useRescheduleAppointment).mockReturnValue({
    mutateAsync: rescheduleMutate,
    isPending: false,
  } as never);
  const slotStart = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
  vi.mocked(useDoctorSlots).mockReturnValue({
    data: [{ start: slotStart, end: slotStart }],
    isPending: false,
  } as never);
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <DoctorAppointmentsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { rebookMutate, rescheduleMutate, slotStart };
}

describe('DoctorAppointmentsPage', () => {
  it('Doctor reschedules an upcoming appointment to another slot', async () => {
    const { rescheduleMutate, slotStart } = setup(
      new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    );

    await userEvent.click(screen.getByRole('button', { name: /^reschedule$/i }));
    expect(screen.getByText(/reschedule with ada lovelace/i)).toBeInTheDocument();

    const slotButtons = screen
      .getAllByRole('button')
      .filter((b) => /\d{1,2}:\d{2}/.test(b.textContent ?? ''));
    await userEvent.click(slotButtons[0]!);

    expect(rescheduleMutate).toHaveBeenCalledWith({ id: 'apt-1', body: { startsAt: slotStart } });
  });

  it('Reschedule disabled near start', () => {
    setup(new Date(Date.now() + 60 * 60 * 1000).toISOString());

    const button = screen.getByRole('button', { name: /^reschedule$/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('title', expect.stringMatching(/closes 2 hours before/i));
  });

  it('Doctor books a follow-up from an existing appointment', async () => {
    const { rebookMutate, slotStart } = setup(
      new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      'COMPLETED',
    );

    // A completed appointment is not upcoming, so it can't be rescheduled.
    expect(screen.queryByRole('button', { name: /^reschedule$/i })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /book again/i }));
    expect(screen.getByText(/book a follow-up with ada lovelace/i)).toBeInTheDocument();

    const slotButtons = screen
      .getAllByRole('button')
      .filter((b) => /\d{1,2}:\d{2}/.test(b.textContent ?? ''));
    await userEvent.click(slotButtons[0]!);

    expect(rebookMutate).toHaveBeenCalledWith({ id: 'apt-1', body: { startsAt: slotStart } });
  });

  it('Book again is not offered on an upcoming appointment', () => {
    setup(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), 'BOOKED');

    expect(screen.queryByRole('button', { name: /book again/i })).not.toBeInTheDocument();
  });

  it('Book again is offered on every past appointment, whatever its outcome', () => {
    setup(new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), 'CANCELLED');

    expect(screen.getByRole('button', { name: /book again/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^reschedule$/i })).not.toBeInTheDocument();
  });
});
