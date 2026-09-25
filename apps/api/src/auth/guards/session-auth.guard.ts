import { Injectable, UnauthorizedException, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { SessionService } from '../session/session.service.js';
import { readSessionToken } from '../session/session-cookie.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import type { AuthUser } from '../current-user.js';

/**
 * Deny-by-default: every route requires a valid, unexpired, unrevoked session
 * belonging to an ACTIVE user unless it carries `@Public()`. Registered as the
 * global `APP_GUARD`, so a new controller is protected unless someone opts it
 * out explicitly.
 */
@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessionService: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const token = readSessionToken(request);
    if (!token) {
      throw new UnauthorizedException('Sign in required');
    }

    const validated = await this.sessionService.validateSession(token);
    if (!validated) {
      throw new UnauthorizedException('Sign in required');
    }

    const { session, user } = validated;
    request.user = { id: user.id, email: user.email, role: user.role, sessionId: session.id };
    return true;
  }
}
