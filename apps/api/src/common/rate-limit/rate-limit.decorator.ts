import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_KEY = 'rateLimit';

export interface RateLimitOptions {
  /** Maximum requests allowed per client within the window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

/** Applies a per-route, per-client-IP request limit, enforced by `RateLimitGuard`. */
export const RateLimit = (options: RateLimitOptions) => SetMetadata(RATE_LIMIT_KEY, options);
