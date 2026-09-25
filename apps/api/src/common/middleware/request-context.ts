import { AsyncLocalStorage } from 'node:async_hooks';
import type { NextFunction, Request, Response } from 'express';
import { REQUEST_ID_HEADER } from './request-id.middleware.js';

export interface RequestContext {
  requestId: string;
  ip?: string;
  userAgent?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

/**
 * Makes the current request's ID, client IP, and user agent available to
 * code that has no `Request` object in hand — chiefly `AuditService.record`,
 * which is called from deep inside a service's transaction, not a
 * controller. Registered in `configure-app.ts` after `requestIdMiddleware`
 * and `clientIpMiddleware`, whose work it reads (`req.headers`/`req.clientIp`
 * are already set by the time this runs). `AsyncLocalStorage.run`'s callback
 * covers every synchronous and asynchronous step that follows `next()`,
 * which is how a value set here survives into a later `await` deep in a
 * service call.
 */
export function requestContextMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const requestId = req.headers[REQUEST_ID_HEADER] as string;
  const context: RequestContext = {
    requestId,
    ip: (req as Request & { clientIp?: string }).clientIp,
    userAgent: req.headers['user-agent'],
  };
  storage.run(context, next);
}

/** `undefined` outside a request (e.g. a script, or a test calling a service directly). */
export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}
