import { NotificationType } from '../generated/prisma/enums.js';
import type { NotificationDraft } from './notification.types.js';

export interface DoctorPendingReviewNotificationParams {
  /** Every currently active administrator account. */
  adminIds: string[];
  doctorId: string;
  doctorName: string;
}

/**
 * One "doctor waiting for approval" notification per active administrator,
 * staged in the registration transaction so it never outlives (or is missing
 * for) the registration it describes — same pure draft-builder shape as
 * `refill-notifications.ts`.
 */
export function doctorPendingReviewNotificationDrafts(
  params: DoctorPendingReviewNotificationParams,
): NotificationDraft[] {
  return params.adminIds.map((adminId) => ({
    userId: adminId,
    type: NotificationType.DOCTOR_PENDING_REVIEW,
    title: 'Doctor awaiting review',
    body: `${params.doctorName} registered and is waiting for profile approval`,
    link: `/admin/doctors/${params.doctorId}`,
  }));
}
