# Spec Delta

## MODIFIED Requirements

### Requirement: Appointment event notifications
The system SHALL create notifications for appointment events, in the same database transaction
as the event:
- When a patient books, the doctor receives "New booking" and the patient receives "Booking
  confirmed".
- When a patient reschedules, the doctor receives "Appointment rescheduled" with the old and new
  times, and the patient receives "Reschedule confirmed".
- When either participant cancels, the other participant receives "Appointment cancelled" with
  who cancelled and the reason, if one was given.
Each notification SHALL include the appointment ID, its start time (and the previous start time
for reschedules), the other participant's display name, and a link to the appointment in the
recipient's role area. When the appointment is for one of the patient's dependents, the
doctor-facing notification names the dependent instead of the account holder — the doctor is
notified about who they are actually seeing; the patient's own notification is unaffected, since
the account holder already knows who they booked for. If the event fails, no notification MUST be
created.

#### Scenario: Booking notifies both
- **WHEN** a patient books an appointment
- **THEN** the doctor has one unread "New booking" notification and the patient has one unread "Booking confirmed" notification, both referencing the appointment

#### Scenario: Booking for a dependent notifies the doctor by the dependent's name
- **WHEN** a patient books an appointment for one of their dependents
- **THEN** the doctor's "New booking" notification names the dependent, not the account holder

#### Scenario: Reschedule notifies both
- **WHEN** a patient reschedules an appointment
- **THEN** the doctor receives "Appointment rescheduled" with the old and new start times, and the patient receives "Reschedule confirmed"

#### Scenario: Cancellation notifies the other participant
- **WHEN** a doctor cancels an appointment with the reason "Unexpected emergency"
- **THEN** the patient receives "Appointment cancelled" naming the doctor and the reason, and the doctor receives no notification for it

#### Scenario: Failed event creates nothing
- **WHEN** a booking is rejected, for example with `SLOT_UNAVAILABLE`
- **THEN** no notification is created for anyone
