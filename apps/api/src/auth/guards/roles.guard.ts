import { ForbiddenException, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import type { AuthUser } from '../current-user.js';
import type { Role } from '../../generated/prisma/enums.js';

/**
 * Runs after `SessionAuthGuard`. A route with no `@Roles()` metadata is open to
 * any signed-in user; a route with `@Roles(...)` requires the current user's
 * role to be in that list.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    if (!request.user || !requiredRoles.includes(request.user.role)) {
      throw new ForbiddenException('Not allowed for this role');
    }
    return true;
  }
}
