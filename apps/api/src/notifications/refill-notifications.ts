import { NotificationType } from '../generated/prisma/enums.js';
import type { NotificationDraft } from './notification.types.js';

export interface RefillRequestedNotificationParams {
  appointmentId: string;
  doctorId: string;
  /** The account holder's or dependent's display name, whichever the prescription's consultation was for. */
  requesterName: string;
}

/**
 * Notification drafts for the refill-request flow (`add-prescription-refills`),
 * kept separate from `appointment-notifications.ts` since these are triggered
 * by a refill decision, not an appointment lifecycle event — same pure-function
 * draft-builder shape (no I/O), so `RefillsService` stays easy to test.
 */
export function refillRequestedNotificationDraft(params: RefillRequestedNotificationParams): NotificationDraft {
  return {
    userId: params.doctorId,
    type: NotificationType.REFILL_REQUESTED,
    title: 'Refill requested',
    body: `${params.requesterName} requested a prescription refill`,
    link: '/doctor/refill-requests',
    appointmentId: params.appointmentId,
  };
}

export interface RefillDecidedNotificationParams {
  appointmentId: string;
  /** The signed-in account that requested the refill — never the dependent, who has no login. */
  requestedById: string;
  approved: boolean;
  doctorNote?: string | null;
}

export function refillDecidedNotificationDraft(params: RefillDecidedNotificationParams): NotificationDraft {
  const title = params.approved ? 'Refill request approved' : 'Refill request denied';
  const body = params.doctorNote ? `${title}: ${params.doctorNote}` : title;
  return {
    userId: params.requestedById,
    type: NotificationType.REFILL_DECIDED,
    title,
    body,
    data: params.doctorNote ? { doctorNote: params.doctorNote } : undefined,
    link: `/patient/records/${params.appointmentId}`,
    appointmentId: params.appointmentId,
  };
}
