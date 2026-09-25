import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { isUUID } from 'class-validator';
import type { Server, Socket } from 'socket.io';
import type { Env } from '../config/env.schema.js';
import { SessionService } from '../auth/session/session.service.js';
import type { SessionRealtimeNotifier } from '../auth/session/session-realtime-notifier.js';
import type { Notification } from '../generated/prisma/client.js';
import { Role } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { toNotificationResponseDto } from '../notifications/notification-mapper.js';
import { ClinicalAccessPolicy } from '../consultations/clinical-access-policy.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { readSessionTokenFromHandshake } from './socket-cookie.js';
import { appointmentRoom, sessionRoom, userRoom } from './rooms.js';

// Well inside the 5-minute revocation-propagation bound from design.md's
// "Risks / Trade-offs" (revocation itself disconnects immediately; this only
// covers natural expiry while a socket stays open).
const REVALIDATE_INTERVAL_MS = 5 * 60_000;

interface SocketData {
  userId: string;
  role: Role;
  sessionId: string;
  token: string;
  revalidateTimer: ReturnType<typeof setInterval>;
  /** Appointment ids this socket currently has the consultation workspace open for; used to clean up presence on disconnect. */
  consultationRooms: Set<string>;
}

interface ConsultationPresencePayload {
  patientPresent: boolean;
  doctorPresent: boolean;
}

interface ConsultationPresenceRoom {
  patientId: string;
  doctorId: string;
  /** userId -> number of that user's sockets currently subscribed. */
  users: Map<string, number>;
}

/**
 * Self-hosted socket.io gateway (no `@nestjs/websockets` transport magic
 * beyond the decorator — see design.md's "Real-time gateway"). Sits outside
 * the `/api` prefix at `/socket.io`, which nginx and the Vite dev proxy
 * already forward with the WebSocket upgrade.
 *
 * Authentication mirrors `SessionAuthGuard` exactly (same `SessionService`
 * method, same account-status check) so a suspended/expired/revoked session
 * can never keep a socket alive just because it bypassed the HTTP guard.
 *
 * `@Public()`: the global `SessionAuthGuard`/`RolesGuard` (`APP_GUARD`s) run
 * for every reflectable handler, including a gateway's `@SubscribeMessage`
 * methods — but they read `request.user` off an HTTP `ExecutionContext`,
 * which doesn't exist for a WS message and makes them reject every message
 * with "Sign in required" (confirmed via the WS exception filter's `cause`
 * during development). WS auth is handled entirely by `authenticate()` and
 * the `socket.data.userId`/`role` checks in each handler below instead. Every new
 * `@SubscribeMessage` handler MUST start with the same `socket.data.userId` check.
 */
@Injectable()
@WebSocketGateway({ path: '/socket.io' })
@Public()
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect, SessionRealtimeNotifier {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  /**
   * In-memory presence, per appointment room (see design.md's "Real-time
   * workspace"). The participant ids are cached here from the appointment
   * lookup made on the first successful subscribe, so leaving (unsubscribe
   * or disconnect) never needs its own async DB round trip — keeping
   * `handleDisconnect` synchronous and every socket test's teardown clean.
   * Lost on API restart; clients re-subscribe on reconnect, which rebuilds
   * it (there is one API instance — see design.md's "Risks / Trade-offs").
   */
  private readonly consultationPresence = new Map<string, ConsultationPresenceRoom>();

  constructor(
    // `forwardRef`: `SessionService` (indirectly, via the
    // `SESSION_REALTIME_NOTIFIER` token) also depends on this class, so the
    // two must be constructed lazily with respect to each other — see
    // `session-realtime-notifier.ts`.
    @Inject(forwardRef(() => SessionService))
    private readonly sessionService: SessionService,
    private readonly configService: ConfigService<Env, true>,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(socket: Socket): Promise<void> {
    const authorized = await this.authenticate(socket);
    if (!authorized) {
      socket.disconnect(true);
    }
  }

  handleDisconnect(socket: Socket): void {
    const data = socket.data as Partial<SocketData>;
    if (data.revalidateTimer) {
      clearInterval(data.revalidateTimer);
    }
    if (data.userId && data.consultationRooms) {
      for (const appointmentId of data.consultationRooms) {
        this.leaveConsultation(data.userId, appointmentId);
      }
    }
  }

  /**
   * Joins the caller's socket to `appointment:{appointmentId}`'s room, after
   * confirming the socket has finished authenticating and
   * `ClinicalAccessPolicy` allows this user to view that workspace.
   * `handleConnection` authenticates asynchronously, so a client can emit
   * this event before `socket.data.userId` is set — checked explicitly
   * rather than assumed from the socket merely being connected. Unauthorized
   * or unauthenticated subscribes are refused and join nothing.
   */
  @SubscribeMessage('consultation:subscribe')
  async handleConsultationSubscribe(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: unknown,
  ): Promise<{ ok: boolean; presence?: ConsultationPresencePayload }> {
    const data = socket.data as Partial<SocketData>;
    const appointmentId = extractAppointmentId(body);
    if (!data.userId || !data.role || !appointmentId) {
      return { ok: false };
    }

    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: { patientId: true, doctorId: true, status: true },
    });
    if (!appointment || !ClinicalAccessPolicy.canViewWorkspace({ id: data.userId, role: data.role }, appointment)) {
      return { ok: false };
    }

    await socket.join(appointmentRoom(appointmentId));
    data.consultationRooms?.add(appointmentId);
    const room = this.addPresence(appointmentId, appointment, data.userId);
    this.emitPresence(appointmentId, room);
    return { ok: true, presence: toPresencePayload(room) };
  }

  @SubscribeMessage('consultation:unsubscribe')
  async handleConsultationUnsubscribe(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: unknown,
  ): Promise<{ ok: boolean }> {
    const data = socket.data as Partial<SocketData>;
    const appointmentId = extractAppointmentId(body);
    if (!data.userId || !appointmentId) {
      return { ok: false };
    }

    await socket.leave(appointmentRoom(appointmentId));
    data.consultationRooms?.delete(appointmentId);
    this.leaveConsultation(data.userId, appointmentId);
    return { ok: true };
  }

  /** Fans out newly created notifications to their recipients' rooms only. */
  async publish(notifications: readonly Notification[]): Promise<void> {
    await Promise.all(notifications.map((notification) => this.emitNew(notification)));
  }

  /** Pushed after mark-read/mark-all so every open tab's badge stays in sync. */
  pushUnreadCount(userId: string, unreadCount: number): void {
    this.server?.to(userRoom(userId)).emit('notifications:count', { unreadCount });
  }

  /**
   * Disconnects every socket backed by one of these sessions. Called by
   * `SessionService` on every revocation path (logout, logout-all, password
   * change), so a revoked session can never keep receiving live events.
   */
  disconnectSessions(sessionIds: readonly string[]): void {
    if (!this.server) return;
    for (const sessionId of sessionIds) {
      this.server.in(sessionRoom(sessionId)).disconnectSockets(true);
    }
  }

  /** Exposed for `add-consultations-and-records` to reuse this connection. */
  async joinRoom(socket: Socket, room: string): Promise<void> {
    await socket.join(room);
  }

  emitToRoom(room: string, event: string, payload: unknown): void {
    this.server?.to(room).emit(event, payload);
  }

  private addPresence(
    appointmentId: string,
    appointment: { patientId: string; doctorId: string },
    userId: string,
  ): ConsultationPresenceRoom {
    let room = this.consultationPresence.get(appointmentId);
    if (!room) {
      room = { patientId: appointment.patientId, doctorId: appointment.doctorId, users: new Map() };
      this.consultationPresence.set(appointmentId, room);
    }
    room.users.set(userId, (room.users.get(userId) ?? 0) + 1);
    return room;
  }

  /** Decrements presence for one of `userId`'s sockets and re-emits. Purely in-memory — never a DB round trip — so disconnect cleanup stays synchronous. */
  private leaveConsultation(userId: string, appointmentId: string): void {
    const room = this.consultationPresence.get(appointmentId);
    if (!room) return;
    const count = room.users.get(userId);
    if (count === undefined) return;
    if (count <= 1) {
      room.users.delete(userId);
    } else {
      room.users.set(userId, count - 1);
    }
    if (room.users.size === 0) {
      this.consultationPresence.delete(appointmentId);
    }
    this.emitPresence(appointmentId, room);
  }

  private emitPresence(appointmentId: string, room: ConsultationPresenceRoom): void {
    this.server?.to(appointmentRoom(appointmentId)).emit('consultation:presence', toPresencePayload(room));
  }

  private async emitNew(notification: Notification): Promise<void> {
    const unreadCount = await this.prisma.notification.count({
      where: { userId: notification.userId, readAt: null },
    });
    this.server?.to(userRoom(notification.userId)).emit('notification:new', {
      notification: toNotificationResponseDto(notification),
      unreadCount,
    });
  }

  private async authenticate(socket: Socket): Promise<boolean> {
    const origin = socket.handshake.headers.origin;
    if (origin !== undefined && !this.allowedOrigins.includes(origin)) {
      this.logger.warn(`Rejected socket handshake from disallowed origin ${origin}`);
      return false;
    }

    const token = readSessionTokenFromHandshake(socket.handshake.headers.cookie);
    if (!token) return false;

    const validated = await this.sessionService.validateSession(token);
    if (!validated) return false;

    const data: SocketData = {
      userId: validated.user.id,
      role: validated.user.role,
      sessionId: validated.session.id,
      token,
      revalidateTimer: this.scheduleRevalidation(socket),
      consultationRooms: new Set(),
    };
    Object.assign(socket.data as object, data);

    await socket.join(userRoom(validated.user.id));
    await socket.join(sessionRoom(validated.session.id));
    return true;
  }

  private scheduleRevalidation(socket: Socket): ReturnType<typeof setInterval> {
    const timer = setInterval(() => {
      void this.revalidate(socket);
    }, REVALIDATE_INTERVAL_MS);
    timer.unref();
    return timer;
  }

  private async revalidate(socket: Socket): Promise<void> {
    const { token } = socket.data as Partial<SocketData>;
    if (!token) {
      socket.disconnect(true);
      return;
    }
    const validated = await this.sessionService.validateSession(token, { countsAsActivity: false });
    if (!validated) {
      socket.disconnect(true);
    }
  }

  private get allowedOrigins(): readonly string[] {
    return this.configService.get('APP_ORIGINS', { infer: true });
  }
}

function toPresencePayload(room: ConsultationPresenceRoom): ConsultationPresencePayload {
  return {
    patientPresent: (room.users.get(room.patientId) ?? 0) > 0,
    doctorPresent: (room.users.get(room.doctorId) ?? 0) > 0,
  };
}

/** Validates and extracts `body.appointmentId`; `undefined` for anything malformed, so callers refuse rather than query with untrusted input. */
function extractAppointmentId(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null) return undefined;
  const appointmentId = (body as { appointmentId?: unknown }).appointmentId;
  if (typeof appointmentId !== 'string' || !isUUID(appointmentId, '4')) return undefined;
  return appointmentId;
}
