import { describe, expect, it } from '@jest/globals';
import { isSessionUsable } from './session-expiry.js';

const idleMinutes = 120;
const absoluteHours = 12;

function makeSession(overrides: Partial<Parameters<typeof isSessionUsable>[0]> = {}) {
  const now = new Date('2026-01-01T12:00:00.000Z');
  return {
    createdAt: now,
    lastUsedAt: now,
    revokedAt: null,
    expiresAt: new Date(now.getTime() + absoluteHours * 3_600_000),
    ...overrides,
  };
}

describe('isSessionUsable', () => {
  it('is usable immediately after creation', () => {
    const session = makeSession();
    const now = session.createdAt;
    expect(isSessionUsable(session, now, idleMinutes, absoluteHours)).toBe(true);
  });

  it('is usable just under the idle limit', () => {
    const session = makeSession();
    const now = new Date(session.lastUsedAt.getTime() + idleMinutes * 60_000 - 1000);
    expect(isSessionUsable(session, now, idleMinutes, absoluteHours)).toBe(true);
  });

  it('is expired just over the idle limit', () => {
    const session = makeSession();
    const now = new Date(session.lastUsedAt.getTime() + idleMinutes * 60_000 + 1000);
    expect(isSessionUsable(session, now, idleMinutes, absoluteHours)).toBe(false);
  });

  it('is expired just over the absolute limit even if recently used', () => {
    const created = new Date('2026-01-01T00:00:00.000Z');
    const session = makeSession({
      createdAt: created,
      lastUsedAt: new Date(created.getTime() + absoluteHours * 3_600_000 - 1000),
      expiresAt: new Date(created.getTime() + absoluteHours * 3_600_000),
    });
    const now = new Date(created.getTime() + absoluteHours * 3_600_000 + 1000);
    expect(isSessionUsable(session, now, idleMinutes, absoluteHours)).toBe(false);
  });

  it('is never usable once revoked', () => {
    const session = makeSession({ revokedAt: new Date('2026-01-01T11:00:00.000Z') });
    expect(isSessionUsable(session, session.createdAt, idleMinutes, absoluteHours)).toBe(false);
  });
});
