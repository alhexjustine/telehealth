# Proposal

## Why

Booking is the center of the core journey: after finding a doctor, the patient must be able to
book, reschedule, or cancel a consultation. The system must never double-book a doctor or a
patient. The brief requires availability and conflict rules enforced by NestJS, with no external
scheduling service.

## What Changes

- Patients book an available slot with an approved doctor, giving a reason and optionally the
  symptoms from guided matching. Booking requires a complete patient profile.
- Booking rules:
  - the time must be one of the doctor's currently available slots
  - no overlap with the patient's other appointments
  - at most 60 days ahead
  - at most 5 upcoming appointments per patient
- Double-booking is impossible even under concurrent requests. A database constraint forbids
  overlapping active appointments for the same doctor or the same patient, backing up the service
  checks.
- Patients reschedule to another slot with the same doctor, at least 2 hours before the start. The
  history chain is kept.
- Patients cancel any time before the start, with an optional reason. Doctors cancel their own
  upcoming appointments with a required reason.
- Patients and doctors list their upcoming and past appointments and view an appointment's
  details. Only participants can see an appointment.
- Changes to availability:
  - booked times no longer appear as available slots
  - doctors cannot save a schedule or add time off that would leave an existing booking outside
    their availability; the conflicting appointments are listed so the doctor can cancel them
    first
- API error responses gain a machine-readable `code` for business-rule violations (for example
  `SLOT_UNAVAILABLE`), so the web can react precisely.
- Web:
  - booking confirmation from the doctor profile's slot picker, with the reason prefilled from
    matched symptoms
  - patient appointments page with reschedule and cancel
  - doctor appointments page and "today" queue on the doctor home
  - schedule-conflict display on the doctor schedule page
- Documentation: Patient and Doctor module pages, a booking sequence diagram including the
  constraint, L3 components, and the regenerated data model.

No external SaaS, BaaS, or scheduling service is introduced. No new runtime dependencies are
expected.

**Product modules affected:** Patient (booking, managing appointments) and Doctor (appointment
list, cancellation, schedule protection).

## Capabilities

### New Capabilities
- `appointments`: Booking, rescheduling, cancelling, listing, and viewing appointments; the
  booking rules; conflict prevention; and the related patient and doctor web pages.

### Modified Capabilities
- `doctor-availability`: Slot calculation excludes booked appointments, and schedule and time-off
  changes are rejected when they would orphan an existing booking.
- `local-deployment`: The standard API error body gains an optional machine-readable `code` for
  business-rule violations.

## Impact

- API: new `appointments` module (`/api/appointments/...`). The availability service and
  `generateSlots` take booked intervals. The exception filter supports error codes.
- Database: new `appointments` and `appointment_symptoms` tables, and PostgreSQL exclusion
  constraints (btree_gist, enabled in the first migration) on doctor and patient time ranges for
  active appointments.
- Web: booking page, `/patient/appointments`, `/doctor/appointments`, doctor home queue, and
  schedule page conflict handling.
- The generated API client and the docs are regenerated.
