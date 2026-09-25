/** How far ahead a patient may book, per the "Book an appointment" requirement. */
export const BOOKING_HORIZON_DAYS = 60;

/** A patient may have at most this many upcoming `BOOKED` appointments at once. */
export const MAX_UPCOMING_PER_PATIENT = 5;

/** Rescheduling closes this many minutes before an appointment's current start. */
export const RESCHEDULE_CUTOFF_MINUTES = 120;
