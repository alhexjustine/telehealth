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

/** True if `event` does NOT arrive within `timeoutMs` (used to assert absence). */
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
 * Subscribes, retrying briefly on `{ ok: false }` — the same authentication
 * race documented in `consultations-realtime.e2e-spec.ts`.
 */
async function subscribeUntilAuthenticated(socket: Socket, appointmentId: string, attempts = 20): Promise<{ ok: boolean }> {
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

describe('Live message delivery', () => {
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

  it('Recipient sees a message live', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const appointment = await createAppointmentDirect(app, {
      patientId: patient.id,
      doctorId: doctor.id,
      startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    const doctorSocket = connectSocket(baseUrl, doctor.token);
    openSockets.push(doctorSocket);
    await waitForEvent(doctorSocket, 'connect');
    const ack = await subscribeUntilAuthenticated(doctorSocket, appointment.id);
    expect(ack.ok).toBe(true);

    const [messageEvent] = await Promise.all([
      waitForEvent<{ body: string; senderId: string }>(doctorSocket, 'message:new'),
      patient.agent.post(`/api/appointments/${appointment.id}/messages`).send({ body: 'Are you there?' }).expect(201),
    ]);
    expect(messageEvent.body).toBe('Are you there?');
    expect(messageEvent.senderId).toBe(patient.id);
  });

  it('Only participants receive it', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const stranger = await registerPatient(app);
    const appointment = await createAppointmentDirect(app, {
      patientId: patient.id,
      doctorId: doctor.id,
      startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    const strangerSocket = connectSocket(baseUrl, stranger.token);
    openSockets.push(strangerSocket);
    await waitForEvent(strangerSocket, 'connect');
    // A stranger's subscribe attempt is refused (see consultations-realtime.e2e-spec.ts's
    // equivalent test), so they never join the room in the first place.
    const strangerAck = await strangerSocket.emitWithAck('consultation:subscribe', { appointmentId: appointment.id });
    expect(strangerAck.ok).toBe(false);

    const [, quiet] = await Promise.all([
      patient.agent.post(`/api/appointments/${appointment.id}/messages`).send({ body: 'Private note' }).expect(201),
      eventDoesNotArrive(strangerSocket, 'message:new'),
    ]);
    expect(quiet).toBe(true);
  });
});
