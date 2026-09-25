import { describe, expect, it } from '@jest/globals';
import { checkRateLimit } from './rate-limit-window.js';

describe('checkRateLimit', () => {
  const limit = 3;
  const windowMs = 60_000;

  it('allows the first request and starts a window', () => {
    const result = checkRateLimit(undefined, 1000, limit, windowMs);
    expect(result.allowed).toBe(true);
    expect(result.next).toEqual({ count: 1, windowStart: 1000 });
  });

  it('allows requests up to the limit within the window', () => {
    let state = checkRateLimit(undefined, 0, limit, windowMs).next;
    state = checkRateLimit(state, 100, limit, windowMs).next;
    const third = checkRateLimit(state, 200, limit, windowMs);
    expect(third.allowed).toBe(true);
    expect(third.next.count).toBe(3);
  });

  it('rejects the request after the limit within the same window', () => {
    let state = checkRateLimit(undefined, 0, limit, windowMs).next;
    state = checkRateLimit(state, 100, limit, windowMs).next;
    state = checkRateLimit(state, 200, limit, windowMs).next;
    const fourth = checkRateLimit(state, 300, limit, windowMs);
    expect(fourth.allowed).toBe(false);
  });

  it('resets once the window has elapsed', () => {
    let state = checkRateLimit(undefined, 0, limit, windowMs).next;
    state = checkRateLimit(state, 100, limit, windowMs).next;
    state = checkRateLimit(state, 200, limit, windowMs).next;
    const afterWindow = checkRateLimit(state, windowMs + 1, limit, windowMs);
    expect(afterWindow.allowed).toBe(true);
    expect(afterWindow.next).toEqual({ count: 1, windowStart: windowMs + 1 });
  });
});
