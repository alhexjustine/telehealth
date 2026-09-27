# Spec Delta

## MODIFIED Requirements

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
