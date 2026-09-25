import { afterEach, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { io, type Socket } from 'socket.io-client';
import { createTestApp } from './support/test-app.js';
import { resetDatabase } from './support/reset-db.js';
import { registerPatient } from './support/auth-helpers.js';
import { listenOnEphemeralPort } from './support/listen-app.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { NotificationType } from '../src/generated/prisma/enums.js';
import { NotificationsService } from '../src/notifications/notifications.service.js';

/** Waits for one event, or rejects after `timeoutMs` — sockets must never hang a test open. */
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

function connectSocket(baseUrl: string, token?: string): Socket {
  return io(baseUrl, {
    path: '/socket.io',
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
    extraHeaders: token ? { Cookie: `th_session=${token}` } : {},
  });
}

describe('Live delivery', () => {
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

  it('Unauthenticated connection rejected', async () => {
    const socket = connectSocket(baseUrl); // no session cookie
    openSockets.push(socket);

    const disconnectReason = await waitForEvent<string>(socket, 'disconnect');
    expect(disconnectReason).toBeDefined();
    expect(socket.connected).toBe(false);
  });

  it('Only own events', async () => {
    const patientA = await registerPatient(app);
    const patientB = await registerPatient(app);

    const socketA = connectSocket(baseUrl, patientA.token);
    const socketB = connectSocket(baseUrl, patientB.token);
    openSockets.push(socketA, socketB);

    await Promise.all([waitForEvent(socketA, 'connect'), waitForEvent(socketB, 'connect')]);

    const prisma = app.get(PrismaService);
    const notificationsService = app.get(NotificationsService);
    const notification = await prisma.notification.create({
      data: {
        userId: patientA.id,
        type: NotificationType.APPOINTMENT_BOOKED,
        title: 'New booking',
        body: 'New booking with someone',
      },
    });

    const [received] = await Promise.all([
      waitForEvent<{ notification: { id: string }; unreadCount: number }>(socketA, 'notification:new'),
      notificationsService.publish([notification]),
    ]);
    expect(received.notification.id).toBe(notification.id);
    expect(received.unreadCount).toBe(1);

    // Give B's socket the same window to (not) receive anything.
    const bStayedQuiet = await eventDoesNotArrive(socketB, 'notification:new');
    expect(bStayedQuiet).toBe(true);
  });

  it('Disconnected on sign-out', async () => {
    const patient = await registerPatient(app);
    const socket = connectSocket(baseUrl, patient.token);
    openSockets.push(socket);

    await waitForEvent(socket, 'connect');
    expect(socket.connected).toBe(true);

    const disconnectWaiter = waitForEvent<string>(socket, 'disconnect');
    await patient.agent.post('/api/auth/logout').expect(204);

    await disconnectWaiter;
    expect(socket.connected).toBe(false);
  });
});
