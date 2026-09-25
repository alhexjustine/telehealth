import { NotificationType } from '../generated/prisma/enums.js';
import type { NotificationDraft } from './notification.types.js';

interface Participant {
  id: string;
  displayName: string;
}

export interface BookNotificationsParams {
  appointmentId: string;
  doctor: Participant;
  patient: Participant;
  startsAt: Date;
}

export interface RescheduleNotificationsParams {
  /** The id of the newly created appointment; both notifications link here. */
  newAppointmentId: string;
  doctor: Participant;
  patient: Participant;
  startsAt: Date;
  previousStartsAt: Date;
}

export interface CancelNotificationsParams {
  appointmentId: string;
  doctor: Participant;
  patient: Participant;
  cancelledById: string;
  cancellationReason: string | null;
}

interface ActiveParticipant extends Participant {
  /** Whether the account is currently `ACTIVE`; an inactive one is never notified. */
  isActive: boolean;
}

export interface PlatformCancelNotificationsParams {
  appointmentId: string;
  doctor: ActiveParticipant;
  patient: ActiveParticipant;
  reason: string | null;
}

/**
 * Maps each appointment event to the notification rows it creates, kept in
 * one place so the rules can't diverge between book/reschedule/cancel (see
 * design.md's "Recipient rules"). Pure functions: no I/O, easy to unit test.
 */
export function bookNotificationDrafts(params: BookNotificationsParams): NotificationDraft[] {
  const startsAt = params.startsAt.toISOString();
  return [
    {
      userId: params.doctor.id,
      type: NotificationType.APPOINTMENT_BOOKED,
      title: 'New booking',
      body: `New booking with ${params.patient.displayName}`,
      data: { startsAt, counterpartName: params.patient.displayName },
      link: `/doctor/appointments/${params.appointmentId}`,
      appointmentId: params.appointmentId,
    },
    {
      userId: params.patient.id,
      type: NotificationType.BOOKING_CONFIRMED,
      title: 'Booking confirmed',
      body: `Booking confirmed with Dr. ${params.doctor.displayName}`,
      data: { startsAt, counterpartName: params.doctor.displayName },
      link: `/patient/appointments/${params.appointmentId}`,
      appointmentId: params.appointmentId,
    },
  ];
}

export function rescheduleNotificationDrafts(params: RescheduleNotificationsParams): NotificationDraft[] {
  const startsAt = params.startsAt.toISOString();
  const previousStartsAt = params.previousStartsAt.toISOString();
  return [
    {
      userId: params.doctor.id,
      type: NotificationType.APPOINTMENT_RESCHEDULED,
      title: 'Appointment rescheduled',
      body: `Appointment rescheduled with ${params.patient.displayName}`,
      data: { startsAt, previousStartsAt, counterpartName: params.patient.displayName },
      link: `/doctor/appointments/${params.newAppointmentId}`,
      appointmentId: params.newAppointmentId,
    },
    {
      userId: params.patient.id,
      type: NotificationType.RESCHEDULE_CONFIRMED,
      title: 'Reschedule confirmed',
      body: `Reschedule confirmed with Dr. ${params.doctor.displayName}`,
      data: { startsAt, previousStartsAt, counterpartName: params.doctor.displayName },
      link: `/patient/appointments/${params.newAppointmentId}`,
      appointmentId: params.newAppointmentId,
    },
  ];
}

/**
 * Only the counterpart of `cancelledById` is notified — the person who
 * cancelled already knows. A reschedule's internal cancel of the old
 * appointment must never go through this: the reschedule notifications above
 * cover it (see the "Reschedule notifies both" / atomicity tests).
 */
export function cancelNotificationDrafts(params: CancelNotificationsParams): NotificationDraft[] {
  const cancelledByDoctor = params.cancelledById === params.doctor.id;
  const recipient = cancelledByDoctor ? params.patient : params.doctor;
  const cancellerName = cancelledByDoctor ? `Dr. ${params.doctor.displayName}` : params.patient.displayName;
  const body = params.cancellationReason
    ? `Cancelled by ${cancellerName}: ${params.cancellationReason}`
    : `Cancelled by ${cancellerName}`;
  const link = cancelledByDoctor
    ? `/patient/appointments/${params.appointmentId}`
    : `/doctor/appointments/${params.appointmentId}`;

  return [
    {
      userId: recipient.id,
      type: NotificationType.APPOINTMENT_CANCELLED,
      title: 'Appointment cancelled',
      body,
      data: { cancelledByName: cancellerName, reason: params.cancellationReason },
      link,
      appointmentId: params.appointmentId,
    },
  ];
}

/**
 * For an appointment cancelled by an administrator, or as the cascading
 * side effect of a participant's account being deactivated (see design.md's
 * "Status changes reuse domain services"). Every participant whose account
 * is still `ACTIVE` is notified — which, for a deactivation cascade,
 * naturally excludes the just-deactivated account without needing to name
 * it explicitly, since its status is already updated in the same
 * transaction by the time this runs.
 */
export function platformCancelNotificationDrafts(params: PlatformCancelNotificationsParams): NotificationDraft[] {
  const body = params.reason ? `Cancelled by the platform: ${params.reason}` : 'Cancelled by the platform';
  const drafts: NotificationDraft[] = [];

  if (params.doctor.isActive) {
    drafts.push({
      userId: params.doctor.id,
      type: NotificationType.PLATFORM_APPOINTMENT_CANCELLED,
      title: 'Appointment cancelled',
      body,
      data: { reason: params.reason },
      link: `/doctor/appointments/${params.appointmentId}`,
      appointmentId: params.appointmentId,
    });
  }
  if (params.patient.isActive) {
    drafts.push({
      userId: params.patient.id,
      type: NotificationType.PLATFORM_APPOINTMENT_CANCELLED,
      title: 'Appointment cancelled',
      body,
      data: { reason: params.reason },
      link: `/patient/appointments/${params.appointmentId}`,
      appointmentId: params.appointmentId,
    });
  }

  return drafts;
}
