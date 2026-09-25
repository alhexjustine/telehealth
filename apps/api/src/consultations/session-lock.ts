import type { Prisma } from '../generated/prisma/client.js';
import type { SessionState } from '../generated/prisma/enums.js';

export interface SessionRow {
  state: SessionState;
  patientJoinedAt: Date | null;
  doctorJoinedAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
}

/**
 * Lazily creates the consultation-session row (a missing row means
 * `SCHEDULED` — see design.md's "Session model and lazy creation") and locks
 * it with `SELECT ... FOR UPDATE` for the rest of the caller's transaction.
 * Shared by `ConsultationsService` (join/start/complete) and `RecordsService`
 * (note/prescription writes), so a concurrent completion can never race past
 * a note or prescription edit, or vice versa.
 */
export async function lockSession(tx: Prisma.TransactionClient, appointmentId: string): Promise<SessionRow> {
  await tx.$executeRaw`
    INSERT INTO consultation_sessions (appointment_id, state, updated_at)
    VALUES (${appointmentId}::uuid, 'SCHEDULED', now())
    ON CONFLICT (appointment_id) DO NOTHING
  `;
  const rows = await tx.$queryRaw<SessionRow[]>`
    SELECT
      state,
      patient_joined_at AS "patientJoinedAt",
      doctor_joined_at AS "doctorJoinedAt",
      started_at AS "startedAt",
      completed_at AS "completedAt"
    FROM consultation_sessions
    WHERE appointment_id = ${appointmentId}::uuid
    FOR UPDATE
  `;
  const row = rows[0];
  if (!row) {
    // Unreachable: the insert above guarantees the row exists.
    throw new Error('consultation_sessions row missing after insert');
  }
  return row;
}
