# admin-appointments Specification

## Purpose
Gives administrators oversight of every appointment and its consultation state, the means to
resolve invalid bookings, and the ability to cancel when necessary, without ever exposing clinical
content.

## Requirements

### Requirement: Appointment oversight list
An administrator SHALL be able to list all appointments, paginated, filtered by status, by
consultation state, by start date range, by doctor, by patient, and by "invalid only". Each entry
SHALL include the times, both participants' display names, the status, the consultation state,
and any invalid-booking flag. Entries MUST NOT include the reason, symptoms, notes,
prescriptions, or medical history.

#### Scenario: Filter by date and status
- **WHEN** an administrator lists booked appointments starting this week
- **THEN** only booked appointments in that range are returned, with participants and consultation state

#### Scenario: No clinical content
- **WHEN** an administrator lists or opens any appointment
- **THEN** the response contains no reason, symptoms, notes, prescriptions, or medical history

#### Scenario: Non-admin denied
- **WHEN** a signed-in patient or doctor calls any appointment oversight endpoint
- **THEN** the response is `403`

### Requirement: Invalid booking detection
An appointment SHALL be flagged invalid when either condition holds:
- it is `BOOKED` and ended more than 30 minutes ago without being completed: flag `NOT_COMPLETED`
- it is `BOOKED`, has not started, and its doctor is not visible to patients (not approved, or
  account not active): flag `DOCTOR_UNAVAILABLE`

#### Scenario: Past appointment never completed
- **WHEN** a booked appointment ended 2 hours ago and its consultation was never completed
- **THEN** it is flagged `NOT_COMPLETED`

#### Scenario: Upcoming appointment with a rejected doctor
- **WHEN** a doctor with an upcoming booked appointment is rejected
- **THEN** that appointment is flagged `DOCTOR_UNAVAILABLE`

### Requirement: Administrator cancellation
An administrator SHALL be able to cancel any `BOOKED` appointment that has not ended, with a
required reason of 5 to 500 characters. The cancellation SHALL be recorded with the administrator
as the canceller, and SHALL free the doctor's slot.

#### Scenario: Cancel an invalid upcoming appointment
- **WHEN** an administrator cancels an appointment flagged `DOCTOR_UNAVAILABLE` with a reason
- **THEN** its status becomes `CANCELLED` with the administrator and reason recorded

#### Scenario: Cancel without reason
- **WHEN** an administrator cancels without a reason
- **THEN** the response is `400`

#### Scenario: Cancel an ended appointment
- **WHEN** an administrator tries to cancel an appointment that has already ended
- **THEN** the response is `409` with code `APPOINTMENT_NOT_CANCELLABLE`

### Requirement: Mark as not held
An administrator SHALL be able to mark an appointment flagged `NOT_COMPLETED` as `NOT_HELD`, with
a required reason of 5 to 500 characters. `NOT_HELD` appointments SHALL appear in both
participants' past appointments with that status.

#### Scenario: Resolve a stale appointment
- **WHEN** an administrator marks a `NOT_COMPLETED` appointment as not held with the reason "Patient did not attend"
- **THEN** its status becomes `NOT_HELD`, it is no longer flagged, and the patient sees it as not held in their past appointments

#### Scenario: Not eligible
- **WHEN** an administrator tries to mark an upcoming or completed appointment as not held
- **THEN** the response is `409` with code `NOT_ELIGIBLE_FOR_NOT_HELD`

### Requirement: Appointments page in the web app
The admin area SHALL include an appointments page with the filters, a table with status,
consultation state, and invalid-booking badges, and cancel and mark-not-held actions. Each action
requires a reason.

#### Scenario: Invalid-only view
- **WHEN** an administrator turns on the "invalid only" filter
- **THEN** only flagged appointments are shown, each with its flag badge and the matching action
