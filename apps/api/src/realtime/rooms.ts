/** Every authenticated socket joins its user's room; events fan out through it. */
export function userRoom(userId: string): string {
  return `user:${userId}`;
}

/**
 * Every authenticated socket also joins a room keyed by its backing session,
 * so a single revoked session (one browser/tab) can be disconnected without
 * touching the user's other, still-valid sessions.
 */
export function sessionRoom(sessionId: string): string {
  return `session:${sessionId}`;
}

/**
 * One consultation workspace's room, joined only after `ClinicalAccessPolicy`
 * confirms the subscribing socket's user is a participant on that
 * appointment (see `RealtimeGateway`'s `consultation:subscribe` handler and
 * `add-consultations-and-records`'s design.md).
 */
export function appointmentRoom(appointmentId: string): string {
  return `appointment:${appointmentId}`;
}
