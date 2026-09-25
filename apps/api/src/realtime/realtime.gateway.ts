import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import type { Env } from '../config/env.schema.js';
import { SessionService } from '../auth/session/session.service.js';
import type { SessionRealtimeNotifier } from '../auth/session/session-realtime-notifier.js';
import type { Notification } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { toNotificationResponseDto } from '../notifications/notification-mapper.js';
import { readSessionTokenFromHandshake } from './socket-cookie.js';
import { sessionRoom, userRoom } from './rooms.js';

// Well inside the 5-minute revocation-propagation bound from design.md's
// "Risks / Trade-offs" (revocation itself disconnects immediately; this only
// covers natural expiry while a socket stays open).
const REVALIDATE_INTERVAL_MS = 5 * 60_000;

interface SocketData {
  userId: string;
  sessionId: string;
  token: string;
  revalidateTimer: ReturnType<typeof setInterval>;
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
 */
@Injectable()
@WebSocketGateway({ path: '/socket.io' })
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect, SessionRealtimeNotifier {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

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
      sessionId: validated.session.id,
      token,
      revalidateTimer: this.scheduleRevalidation(socket),
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
