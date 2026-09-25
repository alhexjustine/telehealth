import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { ConsultationWorkspacePage } from './workspace';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import { apiClient } from '@/lib/api-client';

vi.mock('@/lib/auth/use-current-user', () => ({ useCurrentUser: vi.fn() }));
vi.mock('@/lib/api-client', () => ({
  apiClient: { GET: vi.fn(), POST: vi.fn(), PUT: vi.fn(), PATCH: vi.fn(), DELETE: vi.fn() },
}));

interface FakeSocket {
  handlers: Record<string, (payload?: unknown) => void>;
  on: (event: string, handler: (payload?: unknown) => void) => void;
  off: (event: string) => void;
  emit: (event: string, payload?: unknown) => void;
  emitWithAck: (event: string, payload?: unknown) => Promise<{ ok: boolean; presence?: unknown }>;
  disconnect: () => void;
}

let fakeSocket: FakeSocket;

function createFakeSocket(): FakeSocket {
  const handlers: Record<string, (payload?: unknown) => void> = {};
  return {
    handlers,
    on: vi.fn((event: string, handler: (payload?: unknown) => void) => {
      handlers[event] = handler;
    }),
    off: vi.fn(),
    emit: vi.fn(),
    emitWithAck: vi.fn().mockResolvedValue({ ok: true, presence: { patientPresent: false, doctorPresent: false } }),
    disconnect: vi.fn(),
  };
}

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => fakeSocket),
}));

const ok = <T,>(data: T) => ({ data, error: undefined, response: { ok: true, status: 200 } as Response });

const DOCTOR = { id: 'doc-1', displayName: 'Dr. Grace Hopper', specializations: [] };
const PATIENT = { id: 'pat-1', displayName: 'Ada Lovelace', age: 30 };

function baseWorkspace(overrides: Record<string, unknown> = {}) {
  return {
    appointmentId: 'apt-1',
    startsAt: new Date(Date.now() + 40 * 60_000).toISOString(),
    endsAt: new Date(Date.now() + 70 * 60_000).toISOString(),
    reason: 'Recurring headaches',
    doctor: DOCTOR,
    patient: PATIENT,
    symptoms: [],
    session: {
      state: 'SCHEDULED',
      patientJoinedAt: null,
      doctorJoinedAt: null,
      startedAt: null,
      completedAt: null,
    },
    ...overrides,
  };
}

function mockCurrentUser(role: 'PATIENT' | 'DOCTOR') {
  vi.mocked(useCurrentUser).mockReturnValue({
    data: {
      id: role === 'DOCTOR' ? 'doc-1' : 'pat-1',
      email: 'user@example.com',
      role,
      status: 'ACTIVE',
      displayName: role === 'DOCTOR' ? 'Dr. Grace Hopper' : 'Ada Lovelace',
    },
  } as never);
}

function renderWorkspace() {
  const queryClient = new QueryClient();
  const router = createMemoryRouter(
    [{ path: '/consultations/:appointmentId', element: <ConsultationWorkspacePage /> }],
    { initialEntries: ['/consultations/apt-1'] },
  );
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('ConsultationWorkspacePage', () => {
  beforeEach(() => {
    fakeSocket = createFakeSocket();
    vi.mocked(apiClient.GET).mockReset();
    vi.mocked(apiClient.POST).mockReset();
    vi.mocked(apiClient.POST).mockResolvedValue(ok({ state: 'SCHEDULED' }));
  });

  it('Early visit shows countdown', async () => {
    mockCurrentUser('PATIENT');
    vi.mocked(apiClient.GET).mockImplementation(((path: unknown) => {
      if (path === '/consultations/{appointmentId}') return Promise.resolve(ok(baseWorkspace()));
      throw new Error(`unexpected GET ${String(path)}`);
    }) as never);

    renderWorkspace();

    expect(await screen.findByTestId('join-countdown')).toHaveTextContent(/joining opens in/i);
  });

  it('Start disabled until the patient joined', async () => {
    mockCurrentUser('DOCTOR');
    vi.mocked(apiClient.GET).mockImplementation(((path: unknown) => {
      if (path === '/consultations/{appointmentId}') {
        return Promise.resolve(
          ok(
            baseWorkspace({
              session: {
                state: 'JOINED',
                patientJoinedAt: null,
                doctorJoinedAt: new Date().toISOString(),
                startedAt: null,
                completedAt: null,
              },
              patientMedicalSummary: { age: 30, medicalConditions: null, allergies: null, currentMedications: null },
              note: null,
              prescriptions: [],
            }),
          ),
        );
      }
      throw new Error(`unexpected GET ${String(path)}`);
    }) as never);

    renderWorkspace();

    const startButton = await screen.findByRole('button', { name: /start consultation/i });
    expect(startButton).toBeDisabled();
  });

  it('Complete disabled without summary', async () => {
    mockCurrentUser('DOCTOR');
    vi.mocked(apiClient.GET).mockImplementation(((path: unknown) => {
      if (path === '/consultations/{appointmentId}') {
        return Promise.resolve(
          ok(
            baseWorkspace({
              session: {
                state: 'IN_PROGRESS',
                patientJoinedAt: new Date().toISOString(),
                doctorJoinedAt: new Date().toISOString(),
                startedAt: new Date().toISOString(),
                completedAt: null,
              },
              patientMedicalSummary: { age: 30, medicalConditions: null, allergies: null, currentMedications: null },
              note: null,
              prescriptions: [],
            }),
          ),
        );
      }
      throw new Error(`unexpected GET ${String(path)}`);
    }) as never);

    renderWorkspace();

    const completeButton = await screen.findByRole('button', { name: /complete consultation/i });
    expect(completeButton).toBeDisabled();
  });

  it('updates the patient view from a mocked consultation:state event, without reloading', async () => {
    mockCurrentUser('PATIENT');
    vi.mocked(apiClient.GET).mockImplementation(((path: unknown) => {
      if (path === '/consultations/{appointmentId}') {
        return Promise.resolve(
          ok(
            baseWorkspace({
              startsAt: new Date(Date.now() - 5 * 60_000).toISOString(),
              endsAt: new Date(Date.now() + 25 * 60_000).toISOString(),
              session: {
                state: 'JOINED',
                patientJoinedAt: new Date().toISOString(),
                doctorJoinedAt: new Date().toISOString(),
                startedAt: null,
                completedAt: null,
              },
            }),
          ),
        );
      }
      throw new Error(`unexpected GET ${String(path)}`);
    }) as never);

    renderWorkspace();

    expect(await screen.findByText(/waiting for the doctor/i)).toBeInTheDocument();

    // The gateway pushes this after the doctor starts the consultation —
    // simulated here directly on the fake socket, with no refetch.
    fakeSocket.handlers['consultation:state']?.({
      state: 'IN_PROGRESS',
      patientJoinedAt: new Date().toISOString(),
      doctorJoinedAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
      completedAt: null,
    });

    expect(await screen.findByText(/consultation is in progress/i)).toBeInTheDocument();
    expect(apiClient.GET).toHaveBeenCalledTimes(1); // still just the initial load
  });
});
