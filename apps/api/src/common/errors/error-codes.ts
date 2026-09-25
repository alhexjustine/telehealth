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
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
