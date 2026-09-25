import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { Env } from '../../config/env.schema.js';
import type { Prisma, Session, User } from '../../generated/prisma/client.js';
import { isSessionUsable } from './session-expiry.js';
import { generateSessionToken, hashSessionToken } from './session-token.js';
import { SESSION_REALTIME_NOTIFIER, type SessionRealtimeNotifier } from './session-realtime-notifier.js';

// Only re-write `lastUsedAt` when it is at least this stale, to limit the
// per-request write load of an otherwise read-only session lookup.
const LAST_USED_AT_THROTTLE_MS = 60_000;

export interface SessionMeta {
  userAgent?: string;
  ip?: string;
}

export interface ValidatedSession {
  session: Session;
  user: User;
}

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<Env, true>,
    @Inject(SESSION_REALTIME_NOTIFIER)
    private readonly realtimeNotifier: SessionRealtimeNotifier,
  ) {}

  private get idleMinutes(): number {
    return this.configService.get('SESSION_IDLE_MINUTES', { infer: true });
  }

  private get absoluteHours(): number {
    return this.configService.get('SESSION_ABSOLUTE_HOURS', { infer: true });
  }

  async createSession(userId: string, meta: SessionMeta): Promise<{ token: string; session: Session }> {
    const token = generateSessionToken();
    const tokenHash = hashSessionToken(token);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.absoluteHours * 3_600_000);

    const session = await this.prisma.session.create({
      data: {
        userId,
        tokenHash,
        createdAt: now,
        lastUsedAt: now,
        expiresAt,
        userAgent: meta.userAgent,
        ip: meta.ip,
      },
    });

    return { token, session };
  }

  /**
   * Looks the session up by token hash and validates it in one place: unknown
   * token, expired/idle/revoked, or a non-ACTIVE user all resolve to `null`. A
   * non-ACTIVE user's sessions are revoked as a side effect so status changes
   * (suspend/deactivate) take effect for every device on their very next request.
   *
   * `countsAsActivity: false` is for background re-checks (e.g. open sockets), which must
   * not refresh `lastUsedAt` or an unattended tab would defeat the idle timeout.
   */
  async validateSession(
    token: string,
    { countsAsActivity = true }: { countsAsActivity?: boolean } = {},
  ): Promise<ValidatedSession | null> {
    const tokenHash = hashSessionToken(token);
    const session = await this.prisma.session.findUnique({ where: { tokenHash }, include: { user: true } });
    if (!session) {
      return null;
    }

    const now = new Date();
    if (!isSessionUsable(session, now, this.idleMinutes, this.absoluteHours)) {
      return null;
    }

    if (session.user.status !== 'ACTIVE') {
      await this.revokeAllSessions(session.userId);
      return null;
    }

    if (countsAsActivity && now.getTime() - session.lastUsedAt.getTime() > LAST_USED_AT_THROTTLE_MS) {
      await this.prisma.session.update({ where: { id: session.id }, data: { lastUsedAt: now } });
    }

    return { session, user: session.user };
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    this.realtimeNotifier.disconnectSessions([sessionId]);
  }

  async revokeAllSessions(userId: string): Promise<void> {
    const revokedIds = await this.revokeMany({ userId, revokedAt: null });
    this.realtimeNotifier.disconnectSessions(revokedIds);
  }

  async revokeAllSessionsExcept(userId: string, keepSessionId: string): Promise<void> {
    const revokedIds = await this.revokeMany({ userId, revokedAt: null, id: { not: keepSessionId } });
    this.realtimeNotifier.disconnectSessions(revokedIds);
  }

  /**
   * `updateMany` doesn't report which rows it touched, but the gateway needs
   * the exact session IDs to disconnect (their sockets are keyed by session,
   * not by user — see `RealtimeGateway.disconnectSessions`). Selecting first
   * and updating by the same IDs keeps both steps consistent.
   */
  private async revokeMany(where: Prisma.SessionWhereInput): Promise<string[]> {
    const sessions = await this.prisma.session.findMany({ where, select: { id: true } });
    const ids = sessions.map((s) => s.id);
    if (ids.length === 0) return ids;
    await this.prisma.session.updateMany({ where: { id: { in: ids } }, data: { revokedAt: new Date() } });
    return ids;
  }
}
