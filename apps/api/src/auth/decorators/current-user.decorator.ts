import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from '../current-user.js';

/** Injects the authenticated user attached by `SessionAuthGuard`. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  const request = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
  if (!request.user) {
    throw new Error('CurrentUser used on a route without SessionAuthGuard');
  }
  return request.user;
});
