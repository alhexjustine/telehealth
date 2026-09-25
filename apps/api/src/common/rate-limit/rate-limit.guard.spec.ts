import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.schema.js';
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

function configServiceFor(throttleDisabled: boolean): ConfigService<Env, true> {
  return { get: () => throttleDisabled } as unknown as ConfigService<Env, true>;
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
    const guard = new RateLimitGuard(reflector, configServiceFor(false));
    const windows = (guard as unknown as { windows: Map<string, unknown> }).windows;

    for (let i = 0; i < 999; i++) {
      guard.canActivate(contextFor(`10.0.${Math.floor(i / 256)}.${i % 256}`));
    }
    expect(windows.size).toBe(999);

    jest.setSystemTime(61_000);
    guard.canActivate(contextFor('192.0.2.1'));

    expect(windows.size).toBe(1);
  });

  it('Rate limiting is active when the disabled flag is unset', () => {
    const guard = new RateLimitGuard(reflector, configServiceFor(false));
    const ip = '203.0.113.5';

    for (let i = 0; i < 10; i++) {
      expect(guard.canActivate(contextFor(ip))).toBe(true);
    }

    expect(() => guard.canActivate(contextFor(ip))).toThrow('Too many requests, please try again later.');
  });

  it('bypasses limiting entirely when THROTTLE_DISABLED is true', () => {
    const guard = new RateLimitGuard(reflector, configServiceFor(true));
    const ip = '203.0.113.6';

    for (let i = 0; i < 20; i++) {
      expect(guard.canActivate(contextFor(ip))).toBe(true);
    }
  });
});
