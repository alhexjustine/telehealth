import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { RateLimitGuard } from './rate-limit.guard.js';

class TestController {
  login(): void {}
}

function contextFor(ip: string): ExecutionContext {
  return {
    getClass: () => TestController,
    getHandler: () => TestController.prototype.login,
    switchToHttp: () => ({ getRequest: () => ({ ip }) }),
  } as unknown as ExecutionContext;
}

describe('RateLimitGuard', () => {
  const reflector = {
    getAllAndOverride: () => ({ limit: 10, windowMs: 60_000 }),
  } as unknown as Reflector;

  afterEach(() => {
    jest.useRealTimers();
  });

  it('evicts expired client windows so memory does not grow without bound', () => {
    jest.useFakeTimers({ now: 0 });
    const guard = new RateLimitGuard(reflector);
    const windows = (guard as unknown as { windows: Map<string, unknown> }).windows;

    for (let i = 0; i < 999; i++) {
      guard.canActivate(contextFor(`10.0.${Math.floor(i / 256)}.${i % 256}`));
    }
    expect(windows.size).toBe(999);

    jest.setSystemTime(61_000);
    guard.canActivate(contextFor('192.0.2.1'));

    expect(windows.size).toBe(1);
  });
});
