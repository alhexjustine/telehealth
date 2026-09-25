import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Registered directly via `app.use()` in main.ts so it runs before Nest's own
 * module-level middleware (including the pino-http request logger), letting
 * both the logger and the exception filter read the same, already-resolved id
 * off `req.headers` instead of coordinating module import order.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const existing = req.headers[REQUEST_ID_HEADER];
  const requestId = typeof existing === 'string' && existing.length > 0 ? existing : randomUUID();
  req.headers[REQUEST_ID_HEADER] = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
}
