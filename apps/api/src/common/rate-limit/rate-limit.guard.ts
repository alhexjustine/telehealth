import { HttpException, HttpStatus, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { RATE_LIMIT_KEY, type RateLimitOptions } from './rate-limit.decorator.js';
import { checkRateLimit, type RateLimitWindowState } from './rate-limit-window.js';

/**
 * In-memory, per-process rate limiter keyed by route + client IP (`req.ip`,
 * which respects Express's `trust proxy` setting). A minimal, dependency-free
 * substitute for `@nestjs/throttler`: that package's CommonJS build calls
 * `require('@nestjs/common')` internally, and `@nestjs/common` is ESM-only
 * (NestJS 12) — real Node 24 handles this via `require(esm)`, but Jest's
 * synthetic CJS module loader does not, breaking every e2e test that touches
 * the module graph. This guard needs nothing from `@nestjs/common` beyond
 * what the rest of the app already imports as ESM, so it has no such conflict.
 *
 * A single in-memory Map only limits requests within one process, which is
 * fine at prototype scale (documented as a trade-off in the auth docs page);
 * it also means each fresh Nest application instance starts with a clean
 * counter, which is exactly what the throttling e2e test relies on.
 */
// Bounds memory: without eviction, every distinct client IP would stay in the map forever.
const SWEEP_EVERY_N_REQUESTS = 1_000;

interface TrackedWindow {
  state: RateLimitWindowState;
  windowMs: number;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly windows = new Map<string, TrackedWindow>();
  private requestsSinceSweep = 0;

  constructor(private readonly reflector: Reflector) {}

  private sweepExpired(now: number): void {
    for (const [key, tracked] of this.windows) {
      if (now - tracked.state.windowStart >= tracked.windowMs) {
        this.windows.delete(key);
      }
    }
  }

  canActivate(context: ExecutionContext): boolean {
    const options = this.reflector.getAllAndOverride<RateLimitOptions | undefined>(RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!options) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const key = `${context.getClass().name}.${context.getHandler().name}:${request.ip ?? 'unknown'}`;
    const now = Date.now();
    if (++this.requestsSinceSweep >= SWEEP_EVERY_N_REQUESTS) {
      this.requestsSinceSweep = 0;
      this.sweepExpired(now);
    }
    const result = checkRateLimit(this.windows.get(key)?.state, now, options.limit, options.windowMs);
    this.windows.set(key, { state: result.next, windowMs: options.windowMs });

    if (!result.allowed) {
      throw new HttpException('Too many requests, please try again later.', HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }
}
