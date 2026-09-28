# Spec Delta

## Purpose

Lets a patient and their doctor exchange short text messages about a shared appointment, so they
can ask questions or follow up outside the live consultation window, without any external
messaging service.

## ADDED Requirements

### Requirement: Sending a message
The patient and the doctor of a `BOOKED` appointment SHALL each be able to send a message to the
other, threaded by that appointment. A message body is required, 1 to 2000 characters after
trimming whitespace. Each message SHALL record its sender, the appointment it belongs to, and the
time it was sent. Sending SHALL be rate-limited per sender to prevent abuse.

#### Scenario: Patient sends a message
- **WHEN** the patient of a booked appointment sends a message with a non-empty body
- **THEN** the message is stored with that patient as sender and the appointment's ID, and is returned with a server-assigned ID and send time

#### Scenario: Empty body rejected
- **WHEN** a participant sends a message whose body is empty or only whitespace
- **THEN** the response is `400` and no message is stored

#### Scenario: Body too long
- **WHEN** a participant sends a message longer than 2000 characters
- **THEN** the response is `400` and no message is stored

#### Scenario: Non-participant denied
- **WHEN** another patient, another doctor, or an administrator tries to send a message on an appointment they are not party to
- **THEN** the response is `404` for patients and doctors, and `403` for administrators, and no message is stored

#### Scenario: Appointment not booked
- **WHEN** a participant tries to send a message on an appointment that is `CANCELLED`, `COMPLETED`, or `NOT_HELD`
- **THEN** the response is `409` with code `APPOINTMENT_NOT_ACTIVE` and no message is stored

#### Scenario: Rate limit exceeded
- **WHEN** a participant sends messages faster than the configured rate limit allows
- **THEN** the response is `429` and no message is stored for the request over the limit

### Requirement: Reading a message thread
The patient and the doctor of a `BOOKED` or `COMPLETED` appointment SHALL be able to list its
message thread, paginated, oldest first. No one else MUST be able to read it, and that includes
administrators.

#### Scenario: Participant reads the thread
- **WHEN** the doctor of a booked appointment lists its messages
- **THEN** the messages are returned oldest first, each with its sender, body, and send time

#### Scenario: Non-participant denied
- **WHEN** another patient, another doctor, or an administrator requests an appointment's message thread
- **THEN** the response is `404` for patients and doctors, and `403` for administrators

#### Scenario: Thread survives completion
- **WHEN** a participant lists the message thread of a now-`COMPLETED` appointment
- **THEN** the previously exchanged messages are still returned

#### Scenario: Thread unavailable once cancelled
- **WHEN** a participant lists the message thread of a `CANCELLED` or `NOT_HELD` appointment
- **THEN** the response is `404`

### Requirement: Live message delivery
While signed in with the appointment's workspace or detail page open, a participant SHALL receive
the other participant's new messages over the existing authenticated real-time connection, within
2 seconds of the message being stored, without reloading. A client MUST only receive messages for
appointments it participates in.

#### Scenario: Recipient sees a message live
- **WHEN** a doctor has the appointment open and the patient sends a message
- **THEN** the doctor sees the new message appear without a page reload

#### Scenario: Only participants receive it
- **WHEN** a message is sent on an appointment
- **THEN** no connection other than the sender's and the other participant's receives it

#### Scenario: Fallback without a live connection
- **WHEN** the real-time connection cannot be established
- **THEN** the web app still shows newly sent messages the next time the thread is loaded

### Requirement: Message thread in the web app
The patient and doctor appointment-detail pages, and the consultation workspace page, SHALL each
include a "Messages" section (the same thread either way) showing the thread oldest first and a
box to send a new message, while the appointment is `BOOKED`. Once the appointment is no longer
`BOOKED`, the thread SHALL remain visible read-only if `COMPLETED`, and SHALL be hidden entirely
otherwise. The workspace page's copy of this section is independent of the consultation session
state (`SCHEDULED`/`JOINED`/`IN_PROGRESS`/`COMPLETED`) — it follows the appointment's own status,
not whether the live call has started.

#### Scenario: Send from the appointment detail page
- **WHEN** a patient types a message and submits it from their appointment detail page
- **THEN** the message appears in the thread immediately and the input is cleared

#### Scenario: Read-only after completion
- **WHEN** a participant opens the appointment detail page of a completed appointment with prior messages
- **THEN** the thread is shown with no way to send a new message

#### Scenario: Available in the consultation workspace regardless of session state
- **WHEN** a participant opens the consultation workspace of a `BOOKED` appointment whose session is still `SCHEDULED` (nobody has joined yet)
- **THEN** the Messages section is shown and a message can be sent
