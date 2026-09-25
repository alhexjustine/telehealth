import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { Env } from '../../config/env.schema.js';
import type { Session, User } from '../../generated/prisma/client.js';
import { isSessionUsable } from './session-expiry.js';
import { generateSessionToken, hashSessionToken } from './session-token.js';

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
   */
  async validateSession(token: string): Promise<ValidatedSession | null> {
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

    if (now.getTime() - session.lastUsedAt.getTime() > LAST_USED_AT_THROTTLE_MS) {
      await this.prisma.session.update({ where: { id: session.id }, data: { lastUsedAt: now } });
    }

    return { session, user: session.user };
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllSessions(userId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllSessionsExcept(userId: string, keepSessionId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null, id: { not: keepSessionId } },
      data: { revokedAt: new Date() },
    });
  }
}
