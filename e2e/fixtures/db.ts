import { Pool } from 'pg';

const connectionString =
  process.env.E2E_DATABASE_URL ?? 'postgresql://telehealth:telehealth@localhost:5433/telehealth?schema=public';

let pool: Pool | undefined;

function getPool(): Pool {
  pool ??= new Pool({ connectionString });
  return pool;
}

/**
 * The one deliberate test-harness shortcut (see design.md's "Browser test
 * package" and the `journey-verification` spec's "Journey passes"): moves an
 * already-booked appointment's `starts_at`/`ends_at` directly in the database
 * into the consultation join window — `[-15min, +30min]` relative to now,
 * mirroring `JOIN_OPENS_BEFORE_MINUTES`/`JOIN_CLOSES_AFTER_MINUTES` in
 * `apps/api/src/consultations/consultation-state.ts` (duplicated for the web
 * app in `apps/web/src/lib/consultations/consultation-window.ts`) — so the
 * test doesn't have to wait in real time for a slot to become joinable.
 *
 * Only the *timing* is bypassed here: the appointment itself must already
 * exist, created through the real booking/reschedule UI and API first.
 */
export async function moveAppointmentIntoJoinWindow(appointmentId: string): Promise<void> {
  const startsAt = new Date(Date.now() - 2 * 60_000);
  const endsAt = new Date(Date.now() + 28 * 60_000);
  await getPool().query('UPDATE appointments SET starts_at = $2, ends_at = $3 WHERE id = $1', [
    appointmentId,
    startsAt,
    endsAt,
  ]);
}

/** Closes the shared connection pool. Call once per test file, in an `afterAll`, so the process can exit cleanly. */
export async function closeDbPool(): Promise<void> {
  if (!pool) return;
  const current = pool;
  pool = undefined;
  await current.end();
}
