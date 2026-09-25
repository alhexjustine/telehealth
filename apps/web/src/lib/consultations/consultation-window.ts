/**
 * Mirrors `JOIN_OPENS_BEFORE_MINUTES`/`JOIN_CLOSES_AFTER_MINUTES` in
 * `apps/api/src/consultations/consultation-state.ts`. Duplicated (not
 * imported from the generated api-client, which carries only types, not
 * runtime constants) per design.md's "Join action appears in the window" —
 * pinned equal by `consultation-window.test.ts`.
 */
export const JOIN_OPENS_BEFORE_MINUTES = 15;
export const JOIN_CLOSES_AFTER_MINUTES = 30;

/** Whether joining the consultation is currently allowed, given the appointment's status and times. */
export function isJoinable(params: { status: string; startsAt: string; endsAt: string; now?: Date }): boolean {
  if (params.status !== 'BOOKED') return false;
  const now = (params.now ?? new Date()).getTime();
  const windowStart = new Date(params.startsAt).getTime() - JOIN_OPENS_BEFORE_MINUTES * 60_000;
  const windowEnd = new Date(params.endsAt).getTime() + JOIN_CLOSES_AFTER_MINUTES * 60_000;
  return now >= windowStart && now <= windowEnd;
}

/** When the join window opens for an appointment starting at `startsAt`. */
export function joinWindowOpensAt(startsAt: string): Date {
  return new Date(new Date(startsAt).getTime() - JOIN_OPENS_BEFORE_MINUTES * 60_000);
}
