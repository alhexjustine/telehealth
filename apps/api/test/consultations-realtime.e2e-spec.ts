import { afterEach, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { io, type Socket } from 'socket.io-client';
import { createTestApp } from './support/test-app.js';
import { resetDatabase } from './support/reset-db.js';
import { registerPatient } from './support/auth-helpers.js';
import { createAppointmentDirect, registerBookableDoctor, registerBookablePatient } from './support/appointment-helpers.js';
import { listenOnEphemeralPort } from './support/listen-app.js';

function waitForEvent<T = unknown>(socket: Socket, event: string, timeoutMs = 2000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for "${event}"`)), timeoutMs);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

function eventDoesNotArrive(socket: Socket, event: string, timeoutMs = 500): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(true), timeoutMs);
    socket.once(event, () => {
      clearTimeout(timer);
      resolve(false);
    });
  });
}

/**
 * Subscribes, retrying briefly on `{ ok: false }`. The client's own
 * `connect` event fires once the transport is up, before the server's async
 * `authenticate()` (a DB round trip) has necessarily finished — the same
 * race the coordinator flagged for `handleConsultationSubscribe`. A real
 * client handles it by retrying; these "happy path" tests do the same
 * instead of asserting success on the very first attempt.
 */
async function subscribeUntilAuthenticated(
  socket: Socket,
  appointmentId: string,
  attempts = 20,
): Promise<{ ok: boolean; presence?: { patientPresent: boolean; doctorPresent: boolean } }> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const ack = await socket.emitWithAck('consultation:subscribe', { appointmentId });
    if (ack.ok) return ack;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Never authenticated in time to subscribe to ${appointmentId}`);
}

function connectSocket(baseUrl: string, token?: string): Socket {
  return io(baseUrl, {
    path: '/socket.io',
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
    extraHeaders: token ? { Cookie: `th_session=${token}` } : {},
  });
}

describe('Live state and presence', () => {
  let app: INestApplication;
  let baseUrl: string;
  const openSockets: Socket[] = [];

  beforeAll(async () => {
    await resetDatabase();
  });

  beforeEach(async () => {
    app = await createTestApp();
    ({ baseUrl } = await listenOnEphemeralPort(app));
  });

  afterEach(async () => {
    for (const socket of openSockets.splice(0)) {
      socket.removeAllListeners();
      socket.disconnect();
    }
    await app.close();
  });

  it('Patient sees the session start', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const appointment = await createAppointmentDirect(app, {
      patientId: patient.id,
      doctorId: doctor.id,
      startsAt: new Date(Date.now() + 60_000),
    });
    await patient.agent.post(`/api/consultations/${appointment.id}/join`).expect(200);

    const patientSocket = connectSocket(baseUrl, patient.token);
    openSockets.push(patientSocket);
    await waitForEvent(patientSocket, 'connect');

    const subscribeAck = await subscribeUntilAuthenticated(patientSocket, appointment.id);
    expect(subscribeAck.ok).toBe(true);

    const [stateEvent] = await Promise.all([
      waitForEvent<{ state: string }>(patientSocket, 'consultation:state'),
      doctor.agent.post(`/api/consultations/${appointment.id}/start`).expect(200),
    ]);
    expect(stateEvent.state).toBe('IN_PROGRESS');
  });

  it('Presence indicator', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const appointment = await createAppointmentDirect(app, {
      patientId: patient.id,
      doctorId: doctor.id,
      startsAt: new Date(Date.now() + 60_000),
    });

    const patientSocket = connectSocket(baseUrl, patient.token);
    openSockets.push(patientSocket);
    await waitForEvent(patientSocket, 'connect');
    const patientAck = await subscribeUntilAuthenticated(patientSocket, appointment.id);
    expect(patientAck.presence).toEqual({ patientPresent: true, doctorPresent: false });

    const doctorSocket = connectSocket(baseUrl, doctor.token);
    openSockets.push(doctorSocket);
    await waitForEvent(doctorSocket, 'connect');

    const [presenceEvent, doctorAck] = await Promise.all([
      waitForEvent<{ patientPresent: boolean; doctorPresent: boolean }>(patientSocket, 'consultation:presence'),
      subscribeUntilAuthenticated(doctorSocket, appointment.id),
    ]);
    expect(presenceEvent).toEqual({ patientPresent: true, doctorPresent: true });
    expect(doctorAck.presence).toEqual({ patientPresent: true, doctorPresent: true });
  });

  it('Subscribing to someone else\'s workspace', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const stranger = await registerPatient(app);
    const appointment = await createAppointmentDirect(app, {
      patientId: patient.id,
      doctorId: doctor.id,
      startsAt: new Date(Date.now() + 60_000),
    });

    const strangerSocket = connectSocket(baseUrl, stranger.token);
    openSockets.push(strangerSocket);
    await waitForEvent(strangerSocket, 'connect');

    const ack = await strangerSocket.emitWithAck('consultation:subscribe', { appointmentId: appointment.id });
    expect(ack.ok).toBe(false);

    // Confirm no room membership: a later state change never reaches them.
    await patient.agent.post(`/api/consultations/${appointment.id}/join`).expect(200);
    const quiet = await eventDoesNotArrive(strangerSocket, 'consultation:state');
    expect(quiet).toBe(true);
  });

  it('subscribes immediately after connect, before waiting for the connect event, without crashing the server', async () => {
    // `handleConnection` authenticates asynchronously (a DB round trip), so a
    // client that emits right after opening the socket — never awaiting its
    // own `connect` event — can have this message reach the server before
    // `socket.data.userId` is set. `RealtimeGateway.handleConsultationSubscribe`
    // must handle that without throwing or granting access; see the
    // deterministic unit test in `realtime.gateway.spec.ts` for the exact
    // guard verified with a bare, unauthenticated `socket.data`.
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const appointment = await createAppointmentDirect(app, {
      patientId: patient.id,
      doctorId: doctor.id,
      startsAt: new Date(Date.now() + 60_000),
    });

    const socket = connectSocket(baseUrl, patient.token);
    openSockets.push(socket);
    // Deliberately not awaited: emitted in the same tick as `connectSocket`,
    // racing the server's async authentication.
    const ackPromise = socket.emitWithAck('consultation:subscribe', { appointmentId: appointment.id });

    const ack = await ackPromise;
    expect(typeof ack.ok).toBe('boolean');

    // The server is still up and answers a normal request afterward.
    const health = await patient.agent.get('/api/health');
    expect(health.status).toBe(200);
  });
});
