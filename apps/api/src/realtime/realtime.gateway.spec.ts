import { describe, expect, it, jest } from '@jest/globals';
import type { Socket } from 'socket.io';
import { Role } from '../generated/prisma/enums.js';
import { RealtimeGateway } from './realtime.gateway.js';

/**
 * Deterministic coverage for the race the coordinator flagged:
 * `handleConnection` authenticates asynchronously, so a socket message
 * handler can run before `socket.data.userId` is set. These tests call the
 * handlers directly with a bare `socket.data`, instead of relying on real
 * network timing (see `test/consultations-realtime.e2e-spec.ts` for the
 * accompanying over-the-wire test).
 */
function createGateway(findUniqueMock: jest.Mock): RealtimeGateway {
  const prismaStub = { appointment: { findUnique: findUniqueMock } };
  const gateway = new RealtimeGateway(
    {} as never, // SessionService: unused by the handlers under test
    {} as never, // ConfigService: unused by the handlers under test
    prismaStub as never,
  );
  return gateway;
}

function createSocket(data: Record<string, unknown>): Socket {
  const join = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
  const leave = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
  return { data, join, leave } as unknown as Socket;
}

describe('RealtimeGateway consultation subscribe/unsubscribe', () => {
  it('refuses a subscribe from a socket that has not finished authenticating (socket.data.userId unset)', async () => {
    const findUnique = jest.fn();
    const gateway = createGateway(findUnique);
    const socket = createSocket({}); // no userId/role yet — mid-`authenticate()`

    const ack = await gateway.handleConsultationSubscribe(socket, {
      appointmentId: '11111111-1111-4111-8111-111111111111',
    });

    expect(ack).toEqual({ ok: false });
    expect(socket.join).not.toHaveBeenCalled();
    expect(findUnique).not.toHaveBeenCalled(); // never even queries for an unauthenticated socket
  });

  it('refuses a subscribe with a malformed or missing appointmentId', async () => {
    const findUnique = jest.fn();
    const gateway = createGateway(findUnique);
    const socket = createSocket({ userId: 'user-1', role: Role.PATIENT });

    expect(await gateway.handleConsultationSubscribe(socket, {})).toEqual({ ok: false });
    expect(await gateway.handleConsultationSubscribe(socket, { appointmentId: 'not-a-uuid' })).toEqual({ ok: false });
    expect(await gateway.handleConsultationSubscribe(socket, undefined)).toEqual({ ok: false });
    expect(socket.join).not.toHaveBeenCalled();
  });

  it('refuses a subscribe for an appointment the socket is not a participant of', async () => {
    const findUnique = jest
      .fn<() => Promise<{ patientId: string; doctorId: string; status: string }>>()
      .mockResolvedValue({ patientId: 'someone-else', doctorId: 'another-doctor', status: 'BOOKED' });
    const gateway = createGateway(findUnique);
    const socket = createSocket({ userId: 'user-1', role: Role.PATIENT, consultationRooms: new Set() });

    const ack = await gateway.handleConsultationSubscribe(socket, {
      appointmentId: '11111111-1111-4111-8111-111111111111',
    });

    expect(ack).toEqual({ ok: false });
    expect(socket.join).not.toHaveBeenCalled();
  });

  it('refuses an unsubscribe from a socket that has not finished authenticating', async () => {
    const gateway = createGateway(jest.fn());
    const socket = createSocket({});

    const ack = await gateway.handleConsultationUnsubscribe(socket, {
      appointmentId: '11111111-1111-4111-8111-111111111111',
    });

    expect(ack).toEqual({ ok: false });
    expect(socket.leave).not.toHaveBeenCalled();
  });
});
