import type { NextFunction, Request, Response } from 'express';

/**
 * Stashes `req.ip` (which honors Express's `trust proxy` setting) onto
 * `req.clientIp` as soon as the request arrives. `pino-http`'s `serializers.req`
 * runs lazily when the response finishes, and by then `req.ip`'s underlying
 * socket reference is no longer reliably available and resolves to
 * `undefined` — capturing it early is the documented workaround.
 */
export function clientIpMiddleware(req: Request, _res: Response, next: NextFunction): void {
  (req as Request & { clientIp?: string }).clientIp = req.ip;
  next();
}
