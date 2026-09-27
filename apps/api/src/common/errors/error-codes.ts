/**
 * Stable, machine-readable codes for business-rule violations. Sent as
 * `code` in the standard error body (see `GlobalExceptionFilter`) so the web
 * app can react precisely instead of parsing `message` text. Append new
 * codes here as new business rules are added; never repurpose or rename an
 * existing one; the value SHALL stay stable across releases.
 */
export const ErrorCode = {
  /** The patient's profile is missing a required field (see `isPatientProfileComplete`). */
  PROFILE_INCOMPLETE: 'PROFILE_INCOMPLETE',
  /** The requested start/end does not exactly match one of the doctor's currently available slots. */
  SLOT_UNAVAILABLE: 'SLOT_UNAVAILABLE',
  /** The requested start is further ahead than `BOOKING_HORIZON_DAYS`. */
  BEYOND_BOOKING_HORIZON: 'BEYOND_BOOKING_HORIZON',
  /** The patient already has `MAX_UPCOMING_PER_PATIENT` upcoming booked appointments. */
  BOOKING_LIMIT_REACHED: 'BOOKING_LIMIT_REACHED',
  /** The requested time overlaps another of the patient's own booked appointments. */
  PATIENT_CONFLICT: 'PATIENT_CONFLICT',
  /** The appointment being rescheduled starts less than `RESCHEDULE_CUTOFF_MINUTES` from now. */
  RESCHEDULE_WINDOW_CLOSED: 'RESCHEDULE_WINDOW_CLOSED',
  /** The appointment has already started, or its status is not `BOOKED`. */
  APPOINTMENT_NOT_CANCELLABLE: 'APPOINTMENT_NOT_CANCELLABLE',
  /** Saving a schedule or adding time off would leave one or more booked appointments uncovered. */
  SCHEDULE_CONFLICTS_WITH_BOOKINGS: 'SCHEDULE_CONFLICTS_WITH_BOOKINGS',
  /** The appointment behind a consultation workspace/record is not `BOOKED` (e.g. cancelled). */
  APPOINTMENT_NOT_ACTIVE: 'APPOINTMENT_NOT_ACTIVE',
  /** A booking or reschedule was attempted against a doctor who has turned off accepting bookings. */
  DOCTOR_NOT_ACCEPTING_BOOKINGS: 'DOCTOR_NOT_ACCEPTING_BOOKINGS',
  /** A join was attempted outside `[startsAt - 15m, endsAt + 30m]`. */
  OUTSIDE_JOIN_WINDOW: 'OUTSIDE_JOIN_WINDOW',
  /** The doctor tried to start a consultation before the patient joined. */
  PATIENT_NOT_JOINED: 'PATIENT_NOT_JOINED',
  /** The doctor tried to complete a consultation with no patient summary written. */
  SUMMARY_REQUIRED: 'SUMMARY_REQUIRED',
  /** The requested consultation-session action isn't a legal transition from its current state. */
  INVALID_SESSION_TRANSITION: 'INVALID_SESSION_TRANSITION',
  /** A note/prescription write was attempted while the session isn't `JOINED` or `IN_PROGRESS`. */
  SESSION_NOT_ACTIVE: 'SESSION_NOT_ACTIVE',
  /** A note/prescription write was attempted after the consultation was completed. */
  RECORD_LOCKED: 'RECORD_LOCKED',
  /** A consultation already has `MAX_PRESCRIPTIONS_PER_CONSULTATION` prescriptions. */
  PRESCRIPTION_LIMIT_REACHED: 'PRESCRIPTION_LIMIT_REACHED',
  /** An admin status/verification change requested the status the target already has. */
  STATUS_UNCHANGED: 'STATUS_UNCHANGED',
  /** An admin tried to reject a doctor whose verification status is not `PENDING` (e.g. already `APPROVED`). */
  INVALID_VERIFICATION_TRANSITION: 'INVALID_VERIFICATION_TRANSITION',
  /** An admin tried to mark an appointment `NOT_HELD` that isn't flagged `NOT_COMPLETED`. */
  NOT_ELIGIBLE_FOR_NOT_HELD: 'NOT_ELIGIBLE_FOR_NOT_HELD',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
