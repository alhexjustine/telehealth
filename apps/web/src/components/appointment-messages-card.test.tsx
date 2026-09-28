import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppointmentMessagesCard } from './appointment-messages-card';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import { apiClient } from '@/lib/api-client';

vi.mock('@/lib/auth/use-current-user', () => ({ useCurrentUser: vi.fn() }));
vi.mock('@/lib/api-client', () => ({
  apiClient: { GET: vi.fn(), POST: vi.fn(), PUT: vi.fn(), PATCH: vi.fn(), DELETE: vi.fn() },
}));
vi.mock('@/lib/realtime/realtime-provider', () => ({ useRealtimeSocket: () => undefined }));

const ok = <T,>(data: T) => ({ data, error: undefined, response: { ok: true, status: 200 } as Response });

function mockCurrentUser() {
  vi.mocked(useCurrentUser).mockReturnValue({
    data: { id: 'pat-1', email: 'patient@example.com', role: 'PATIENT', status: 'ACTIVE', displayName: 'Ada Lovelace' },
  } as never);
}

function renderCard(status: 'BOOKED' | 'COMPLETED') {
  const queryClient = new QueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <AppointmentMessagesCard appointmentId="apt-1" status={status} counterpartName="Dr. Grace Hopper" />
    </QueryClientProvider>,
  );
}

describe('AppointmentMessagesCard', () => {
  beforeEach(() => {
    mockCurrentUser();
    vi.mocked(apiClient.GET).mockReset();
    vi.mocked(apiClient.POST).mockReset();
  });

  it('Send from the appointment detail page', async () => {
    vi.mocked(apiClient.GET).mockImplementation(((path: unknown) => {
      if (path === '/appointments/{appointmentId}/messages') {
        return Promise.resolve(ok({ items: [], total: 0, page: 1, pageSize: 100 }));
      }
      throw new Error(`unexpected GET ${String(path)}`);
    }) as never);
    vi.mocked(apiClient.POST).mockImplementation(((path: unknown, options: { body: { body: string } }) => {
      if (path === '/appointments/{appointmentId}/messages') {
        return Promise.resolve(
          ok({
            id: 'msg-1',
            appointmentId: 'apt-1',
            senderId: 'pat-1',
            body: options.body.body,
            createdAt: new Date().toISOString(),
          }),
        );
      }
      throw new Error(`unexpected POST ${String(path)}`);
    }) as never);

    renderCard('BOOKED');

    expect(await screen.findByText(/no messages yet/i)).toBeInTheDocument();

    const textarea = screen.getByLabelText(/write a message/i);
    await userEvent.type(textarea, 'What time should I take the medication?');
    await userEvent.click(screen.getByRole('button', { name: /send/i }));

    expect(await screen.findByText('What time should I take the medication?')).toBeInTheDocument();
    expect(screen.getByText(/^you ·/i)).toBeInTheDocument();
    await waitFor(() => expect(textarea).toHaveValue(''));
  });

  it('Read-only after completion', async () => {
    vi.mocked(apiClient.GET).mockImplementation(((path: unknown) => {
      if (path === '/appointments/{appointmentId}/messages') {
        return Promise.resolve(
          ok({
            items: [
              {
                id: 'msg-1',
                appointmentId: 'apt-1',
                senderId: 'doc-1',
                body: 'Your prescription is ready.',
                createdAt: new Date().toISOString(),
              },
            ],
            total: 1,
            page: 1,
            pageSize: 100,
          }),
        );
      }
      throw new Error(`unexpected GET ${String(path)}`);
    }) as never);

    renderCard('COMPLETED');

    expect(await screen.findByText('Your prescription is ready.')).toBeInTheDocument();
    expect(screen.getByText(/^dr\. grace hopper ·/i)).toBeInTheDocument();
    expect(screen.getByText(/this conversation is now read-only/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/write a message/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /send/i })).not.toBeInTheDocument();
  });
});
