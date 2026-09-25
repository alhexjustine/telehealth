export interface SessionExpiryInput {
  createdAt: Date;
  lastUsedAt: Date;
  revokedAt: Date | null;
  expiresAt: Date;
}

/**
 * A session is usable when it hasn't been revoked, hasn't been idle longer than
 * `idleMinutes`, and is within `absoluteHours` of when it was created — whichever
 * limit is hit first. Pulled out as a pure function so expiry logic is testable
 * without a database.
 */
export function isSessionUsable(
  session: SessionExpiryInput,
  now: Date,
  idleMinutes: number,
  absoluteHours: number,
): boolean {
  if (session.revokedAt !== null) {
    return false;
  }
  const idleMs = now.getTime() - session.lastUsedAt.getTime();
  if (idleMs > idleMinutes * 60_000) {
    return false;
  }
  const ageMs = now.getTime() - session.createdAt.getTime();
  if (ageMs > absoluteHours * 3_600_000) {
    return false;
  }
  // `expiresAt` (createdAt + absoluteHours, computed at creation) is a redundant
  // guard against clock/config drift between session creation and this check.
  if (now.getTime() > session.expiresAt.getTime()) {
    return false;
  }
  return true;
}
