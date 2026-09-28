import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

vi.mock('@jitsi/react-sdk', () => ({
  JitsiMeeting: ({ roomName }: { roomName: string }) => <div data-testid="jitsi-meeting">{roomName}</div>,
}));

const ok = <T,>(data: T) => ({ data, error: undefined, response: { ok: true, status: 200 } as Response });

const DOCTOR = { id: 'doc-1', displayName: 'Dr. Grace Hopper', specializations: [] };
const PATIENT = { id: 'pat-1', displayName: 'Ada Lovelace', age: 30 };

function baseWorkspace(overrides: Record<string, unknown> = {}) {
  return {
    appointmentId: 'apt-1',
    status: 'BOOKED',
    roomId: 'consult-fake-room-id',
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

/**
 * Every test mounts `AppointmentMessagesCard`, which fires its own GET for
 * the message thread — handle it generically (empty thread) alongside the
 * workspace fixture each test provides, so tests only need to describe the
 * workspace response they care about.
 */
function mockWorkspaceGet(workspace: Record<string, unknown>) {
  vi.mocked(apiClient.GET).mockImplementation(((path: unknown) => {
    if (path === '/consultations/{appointmentId}') return Promise.resolve(ok(workspace));
    if (path === '/appointments/{appointmentId}/messages') return Promise.resolve(ok({ items: [], total: 0 }));
    throw new Error(`unexpected GET ${String(path)}`);
  }) as never);
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
    mockWorkspaceGet(baseWorkspace());

    renderWorkspace();

    expect(await screen.findByTestId('join-countdown')).toHaveTextContent(/joining opens in/i);
  });

  it('Workspace shows the attendee', async () => {
    mockCurrentUser('DOCTOR');
    mockWorkspaceGet(
      baseWorkspace({
        patient: { id: 'pat-1', displayName: 'Jamie Lovelace', age: 7 },
        dependent: { id: 'dep-1', displayName: 'Jamie Lovelace', relationship: 'CHILD' },
      }),
    );

    renderWorkspace();

    expect(await screen.findByText(/jamie lovelace/i)).toBeInTheDocument();
    expect(screen.getByText('Child')).toBeInTheDocument();
  });

  it('Start disabled until the patient joined', async () => {
    mockCurrentUser('DOCTOR');
    mockWorkspaceGet(
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
    );

    renderWorkspace();

    const startButton = await screen.findByRole('button', { name: /start consultation/i });
    expect(startButton).toBeDisabled();
    expect(await screen.findByText(/waiting for the patient to join/i)).toBeInTheDocument();
  });

  it('Complete disabled without summary', async () => {
    mockCurrentUser('DOCTOR');
    mockWorkspaceGet(
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
    );

    renderWorkspace();

    const completeButton = await screen.findByRole('button', { name: /complete consultation/i });
    expect(completeButton).toBeDisabled();
    expect(await screen.findByText(/write a patient summary above to enable this/i)).toBeInTheDocument();
  });

  it('updates the patient view from a mocked consultation:state event, without reloading', async () => {
    mockCurrentUser('PATIENT');
    mockWorkspaceGet(
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
    );

    renderWorkspace();

    expect(await screen.findByText(/doctor has joined.*waiting for them to start/i)).toBeInTheDocument();

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
    expect(apiClient.GET).toHaveBeenCalledTimes(2); // workspace + message thread, still just the initial load
  });

  it('Waiting message distinguishes doctor not yet joined from joined-but-not-started', async () => {
    mockCurrentUser('PATIENT');
    mockWorkspaceGet(
      baseWorkspace({
        startsAt: new Date(Date.now() - 5 * 60_000).toISOString(),
        endsAt: new Date(Date.now() + 25 * 60_000).toISOString(),
        session: {
          state: 'JOINED',
          patientJoinedAt: new Date().toISOString(),
          doctorJoinedAt: null,
          startedAt: null,
          completedAt: null,
        },
      }),
    );

    renderWorkspace();

    expect(await screen.findByText(/waiting for the doctor to join/i)).toBeInTheDocument();
  });

  it('Video call shown once the consultation starts', async () => {
    mockCurrentUser('DOCTOR');
    mockWorkspaceGet(
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
    );

    renderWorkspace();

    expect(await screen.findByTestId('jitsi-meeting')).toHaveTextContent('consult-fake-room-id');
  });

  it('Findings, prescriptions, and messages are tabbed for the doctor', async () => {
    mockCurrentUser('DOCTOR');
    mockWorkspaceGet(
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
    );

    const user = userEvent.setup();
    renderWorkspace();

    expect(await screen.findByLabelText(/^findings$/i)).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /write a message/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /prescriptions/i }));
    expect(await screen.findByText(/no prescriptions yet/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^findings$/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /messages/i }));
    expect(await screen.findByRole('textbox', { name: /write a message/i })).toBeInTheDocument();
    expect(screen.queryByText(/no prescriptions yet/i)).not.toBeInTheDocument();
  });

  it('No video before the consultation starts or after it completes', async () => {
    mockCurrentUser('PATIENT');
    mockWorkspaceGet(baseWorkspace()); // default session state: SCHEDULED

    renderWorkspace();

    expect(await screen.findByTestId('join-countdown')).toBeInTheDocument();
    expect(screen.queryByTestId('jitsi-meeting')).not.toBeInTheDocument();
  });

  it('No video while only joined, not yet started', async () => {
    mockCurrentUser('PATIENT');
    mockWorkspaceGet(
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
    );

    renderWorkspace();

    expect(await screen.findByText(/doctor has joined/i)).toBeInTheDocument();
    expect(screen.queryByTestId('jitsi-meeting')).not.toBeInTheDocument();
  });

  it('Available in the consultation workspace regardless of session state', async () => {
    mockCurrentUser('PATIENT');
    mockWorkspaceGet(baseWorkspace()); // default: status BOOKED, session state SCHEDULED

    renderWorkspace();

    expect(await screen.findByTestId('join-countdown')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /write a message/i })).toBeInTheDocument();
  });

  it('Video unavailable outside the session window', async () => {
    mockCurrentUser('PATIENT');
    mockWorkspaceGet(
      baseWorkspace({
        session: {
          state: 'COMPLETED',
          patientJoinedAt: new Date().toISOString(),
          doctorJoinedAt: new Date().toISOString(),
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        },
      }),
    );

    renderWorkspace();

    expect(await screen.findByText(/consultation summary/i)).toBeInTheDocument();
    expect(screen.queryByTestId('jitsi-meeting')).not.toBeInTheDocument();
  });
});
