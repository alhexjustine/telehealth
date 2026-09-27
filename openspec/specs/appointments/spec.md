# appointments Specification

## Purpose
Lets patients book, reschedule, and cancel consultations in a doctor's available slots, and lets
both participants manage their appointments. The system guarantees that no doctor or patient is
ever double-booked.

## Requirements

### Requirement: Book an appointment
A signed-in patient SHALL be able to book an appointment by giving a doctor, a start instant, a
reason of 10 to 500 characters, and optionally up to 10 symptom IDs from the catalog. The booking
is accepted only when all of the following hold:
- the patient's profile is complete
- the doctor is visible (approved and active)
- the doctor is currently accepting new bookings
- the start and end exactly match one of the doctor's currently available slots
- the start is at most 60 days ahead
- the patient has fewer than 5 upcoming booked appointments
- the time does not overlap another of the patient's booked appointments
The new appointment's status SHALL be `BOOKED`, and its end is the start plus the doctor's
consultation length.

#### Scenario: Successful booking
- **WHEN** a patient with a complete profile books an available slot with an approved doctor, giving a valid reason and two symptom IDs
- **THEN** the response is `201` with the appointment, status `BOOKED`, the doctor summary, the reason, and the symptoms, and that slot is no longer offered

#### Scenario: Incomplete profile
- **WHEN** a patient whose profile is incomplete tries to book
- **THEN** the response is `409` with code `PROFILE_INCOMPLETE` and nothing is booked

#### Scenario: Not an available slot
- **WHEN** a patient tries to book a time that is outside the doctor's schedule, during their time off, less than 60 minutes away, not aligned to a slot start, or already booked
- **THEN** the response is `409` with code `SLOT_UNAVAILABLE` and nothing is booked

#### Scenario: Too far ahead
- **WHEN** a patient tries to book an otherwise valid slot starting 61 days from now
- **THEN** the response is `409` with code `BEYOND_BOOKING_HORIZON`

#### Scenario: Too many upcoming appointments
- **WHEN** a patient who already has 5 upcoming booked appointments tries to book another
- **THEN** the response is `409` with code `BOOKING_LIMIT_REACHED`

#### Scenario: Patient already busy
- **WHEN** a patient tries to book a slot that overlaps another of their own booked appointments with a different doctor
- **THEN** the response is `409` with code `PATIENT_CONFLICT`

#### Scenario: Hidden doctor
- **WHEN** a patient tries to book with a doctor who is pending, rejected, or suspended
- **THEN** the response is `404`

#### Scenario: Non-patient denied
- **WHEN** a signed-in doctor or administrator tries to book through the patient booking endpoint
- **THEN** the response is `403`

#### Scenario: Doctor not accepting bookings
- **WHEN** a patient tries to book an otherwise-available slot with an approved doctor who has turned off accepting bookings
- **THEN** the response is `409` with code `DOCTOR_NOT_ACCEPTING_BOOKINGS` and nothing is booked

### Requirement: No double-booking under concurrency
The system MUST guarantee that a doctor never has two overlapping `BOOKED` appointments, and a
patient never has two overlapping `BOOKED` appointments, even when requests race. This SHALL be
enforced by the database as well as by the service checks.

#### Scenario: Concurrent bookings of the same slot
- **WHEN** two different patients submit bookings for the same slot of the same doctor at the same moment
- **THEN** exactly one booking succeeds, and the other receives `409` with code `SLOT_UNAVAILABLE`

#### Scenario: Database rejects overlap directly
- **WHEN** an overlapping `BOOKED` appointment for the same doctor is inserted directly into the database, bypassing the service
- **THEN** the database rejects the insert

### Requirement: Reschedule an appointment
A signed-in patient SHALL be able to reschedule their own `BOOKED` appointment to another available
slot with the same doctor, provided the current start is at least 2 hours away. The new slot MUST
satisfy the same rules as a new booking, except that the appointment being rescheduled does not
count toward the limit or toward overlaps. Rescheduling SHALL cancel the original appointment with
the reason "Rescheduled" and create a new `BOOKED` appointment that references the original,
keeping the reason and symptoms, in one atomic operation.

#### Scenario: Successful reschedule
- **WHEN** a patient reschedules an appointment that starts in 2 days to another available slot with the same doctor
- **THEN** the response is `201` with the new appointment, which references the original; the original is `CANCELLED` with reason "Rescheduled"; and the original slot becomes available again

#### Scenario: Too close to start
- **WHEN** a patient tries to reschedule an appointment that starts in 90 minutes
- **THEN** the response is `409` with code `RESCHEDULE_WINDOW_CLOSED` and nothing changes

#### Scenario: New slot unavailable
- **WHEN** a patient tries to reschedule to a slot that is not available
- **THEN** the response is `409` with code `SLOT_UNAVAILABLE`, and the original appointment is still `BOOKED`

#### Scenario: Not the patient's appointment
- **WHEN** a patient tries to reschedule an appointment that belongs to another patient
- **THEN** the response is `404`

#### Scenario: Doctor stopped accepting bookings
- **WHEN** a patient tries to reschedule to a new slot with a doctor who has turned off accepting bookings since the original booking
- **THEN** the response is `409` with code `DOCTOR_NOT_ACCEPTING_BOOKINGS`, and the original appointment is still `BOOKED`

### Requirement: Cancel an appointment
A patient SHALL be able to cancel their own `BOOKED` appointment at any time before it starts, with
an optional reason of at most 500 characters. A doctor SHALL be able to cancel their own `BOOKED`
appointment before it starts, with a required reason of 5 to 500 characters. A cancelled
appointment SHALL record who cancelled it, when, and why, and its time SHALL become available
again.

#### Scenario: Patient cancels
- **WHEN** a patient cancels their appointment that starts tomorrow
- **THEN** the response is `200` with status `CANCELLED`, the cancellation details are recorded, and the slot is offered again

#### Scenario: Doctor cancels with reason
- **WHEN** a doctor cancels their appointment with the reason "Unexpected emergency"
- **THEN** the response is `200` with status `CANCELLED` and the doctor recorded as the canceller

#### Scenario: Doctor cancels without reason
- **WHEN** a doctor tries to cancel without a reason
- **THEN** the response is `400`

#### Scenario: Already started or not booked
- **WHEN** anyone tries to cancel an appointment that has already started, or whose status is not `BOOKED`
- **THEN** the response is `409` with code `APPOINTMENT_NOT_CANCELLABLE`

#### Scenario: Not a participant
- **WHEN** a patient or doctor tries to cancel an appointment they are not part of
- **THEN** the response is `404`

### Requirement: List and view appointments
Patients and doctors SHALL be able to list their own appointments, paginated, as "upcoming" or
"past":
- Upcoming appointments are `BOOKED` ones that have not ended, soonest first.
- Past appointments are all others, most recent first.
- Patients see the doctor's name and specializations.
- Doctors see the patient's name, age, reason, and symptoms.
Either participant SHALL be able to view one appointment's details, including the full reschedule
and cancellation history. No one else can see an appointment through these endpoints.

#### Scenario: Patient lists upcoming
- **WHEN** a patient with two future booked appointments and one cancelled appointment lists upcoming appointments
- **THEN** only the two booked appointments are returned, soonest first

#### Scenario: Doctor lists past
- **WHEN** a doctor lists past appointments
- **THEN** their ended and cancelled appointments are returned, most recent first, each with the patient's name, age, and reason

#### Scenario: Participant views details
- **WHEN** the patient or doctor of an appointment requests its details
- **THEN** the response includes the appointment, the counterpart summary, and its reschedule and cancellation history

#### Scenario: Non-participant denied
- **WHEN** a different patient or doctor requests an appointment's details
- **THEN** the response is `404`

#### Scenario: Signed-out denied
- **WHEN** an unauthenticated client lists or views appointments
- **THEN** the response is `401`

### Requirement: Booking in the web app
From the doctor profile page's slot picker, a patient SHALL be able to open a booking confirmation.
It shows the doctor, the date and time in the patient's time zone, the duration, and a reason
field, prefilled from any symptoms carried over from Find care. When the profile is incomplete, the
confirmation MUST explain this and link to the profile page instead of allowing submission. When
the slot has just been taken, the page MUST say so and refresh the available slots.

#### Scenario: Book from the slot picker
- **WHEN** a patient selects a slot, confirms with a reason, and submits
- **THEN** a success message is shown and the appointment appears in their upcoming appointments

#### Scenario: Slot taken while confirming
- **WHEN** the booking fails with `SLOT_UNAVAILABLE`
- **THEN** the page states that the time was just taken and shows refreshed slots

#### Scenario: Incomplete profile in the web app
- **WHEN** a patient with an incomplete profile opens the booking confirmation
- **THEN** a message with a link to the profile page is shown and the submit button is disabled

### Requirement: Managing appointments in the web app
The patient area SHALL include an appointments page with upcoming and past tabs, status badges,
and, where the rules allow, reschedule (slot picker for the same doctor) and cancel (confirmation
dialog with an optional reason) actions. Actions that are not allowed MUST be disabled with an
explanation. The doctor area SHALL include an appointments page with upcoming and past tabs and a
cancel action that requires a reason. The doctor home page SHALL list today's appointments.

#### Scenario: Reschedule disabled near start
- **WHEN** a patient views an upcoming appointment that starts in 1 hour
- **THEN** the reschedule action is disabled with a note that rescheduling closes 2 hours before the start

#### Scenario: Doctor's today list
- **WHEN** a doctor with three appointments today opens the doctor home page
- **THEN** the three appointments are listed in start order with patient names and reasons
