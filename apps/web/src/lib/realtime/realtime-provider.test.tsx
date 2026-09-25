import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'sonner';
import { RealtimeProvider, useRealtimeConnected } from './realtime-provider';

vi.mock('sonner', () => ({ toast: vi.fn() }));

interface FakeSocket {
  handlers: Record<string, (payload?: unknown) => void>;
  on: (event: string, handler: (payload?: unknown) => void) => void;
  off: (event: string) => void;
  disconnect: () => void;
}

function createFakeSocket(): FakeSocket {
  const handlers: Record<string, (payload?: unknown) => void> = {};
  return {
    handlers,
    on: vi.fn((event: string, handler: (payload?: unknown) => void) => {
      handlers[event] = handler;
    }),
    off: vi.fn(),
    disconnect: vi.fn(),
  };
}

let fakeSocket: FakeSocket;

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => fakeSocket),
}));

function ConnectedProbe() {
  const connected = useRealtimeConnected();
  return <span data-testid="connected">{connected ? 'connected' : 'disconnected'}</span>;
}

function renderProvider() {
  const queryClient = new QueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <RealtimeProvider>
        <ConnectedProbe />
      </RealtimeProvider>
    </QueryClientProvider>,
  );
  return queryClient;
}

describe('RealtimeProvider', () => {
  beforeEach(() => {
    fakeSocket = createFakeSocket();
  });

  it('Fallback without a live connection', () => {
    renderProvider();

    // No "connect" event was ever fired by the (fake) socket — the
    // connection never came up, so `useRealtimeConnected()` must stay
    // false, which is what keeps `useUnreadCount`'s 60s poll active.
    expect(screen.getByTestId('connected')).toHaveTextContent('disconnected');
  });

  it('reports connected once the socket fires "connect"', async () => {
    renderProvider();

    act(() => {
      fakeSocket.handlers.connect?.();
    });

    await waitFor(() => expect(screen.getByTestId('connected')).toHaveTextContent('connected'));
  });

  it('shows a toast when a notification arrives live', () => {
    renderProvider();

    act(() => {
      fakeSocket.handlers['notification:new']?.({
        notification: {
          id: 'n1',
          type: 'APPOINTMENT_BOOKED',
          title: 'New booking',
          body: 'New booking with Ada Lovelace',
          data: null,
          link: '/doctor/appointments/1',
          appointmentId: '1',
          readAt: null,
          createdAt: new Date().toISOString(),
        },
        unreadCount: 1,
      });
    });

    expect(toast).toHaveBeenCalledWith('New booking', { description: 'New booking with Ada Lovelace' });
  });
});
