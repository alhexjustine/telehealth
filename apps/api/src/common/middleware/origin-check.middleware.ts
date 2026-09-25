import { ForbiddenException } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Rejects state-changing requests (any method other than GET/HEAD/OPTIONS) whose
 * `Origin` header is present and not on the configured allow-list. Requests without
 * an `Origin` header (curl, tests, server-to-server) pass through: browsers always
 * send `Origin` on cross-site state-changing requests, and `SameSite=Lax` already
 * withholds the session cookie there, so the absence of the header is not a gap.
 */
export function createOriginCheckMiddleware(allowedOrigins: readonly string[]) {
  const allowed = new Set(allowedOrigins);
  return function originCheckMiddleware(req: Request, _res: Response, next: NextFunction): void {
    if (SAFE_METHODS.has(req.method)) {
      next();
      return;
    }

    const origin = req.headers.origin;
    if (origin === undefined) {
      next();
      return;
    }

    if (!allowed.has(origin)) {
      next(new ForbiddenException('Cross-origin request rejected'));
      return;
    }

    next();
  };
}
