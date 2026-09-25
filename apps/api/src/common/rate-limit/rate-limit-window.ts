export interface RateLimitWindowState {
  count: number;
  windowStart: number;
}

export interface RateLimitCheck {
  allowed: boolean;
  next: RateLimitWindowState;
}

/**
 * Fixed-window counter: pure so it's unit-testable without wall-clock time or
 * a guard/Map. A new window starts once `windowMs` has elapsed since the
 * previous window's start; within a window, the `limit`-th request is still
 * allowed and the `(limit + 1)`-th is rejected.
 */
export function checkRateLimit(
  previous: RateLimitWindowState | undefined,
  now: number,
  limit: number,
  windowMs: number,
): RateLimitCheck {
  if (!previous || now - previous.windowStart >= windowMs) {
    return { allowed: true, next: { count: 1, windowStart: now } };
  }
  if (previous.count < limit) {
    return { allowed: true, next: { count: previous.count + 1, windowStart: previous.windowStart } };
  }
  return { allowed: false, next: previous };
}
