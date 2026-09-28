import { createHmac } from 'node:crypto';

/**
 * Derives the appointment's Jitsi video-call room name from its ID and the
 * server-only `JITSI_ROOM_SECRET`, so the room can't be found by guessing or
 * enumerating appointment IDs (see the `consultation-session` spec's "Video"
 * requirement). Deterministic and unstored — recomputed on every workspace
 * request rather than persisted alongside the appointment.
 */
export function consultationRoomId(appointmentId: string, secret: string): string {
  const digest = createHmac('sha256', secret).update(appointmentId).digest('hex');
  return `consult-${digest.slice(0, 32)}`;
}
