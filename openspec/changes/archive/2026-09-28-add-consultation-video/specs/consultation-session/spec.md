# Spec Delta

## MODIFIED Requirements

### Requirement: Workspace access
The patient and the doctor of a `BOOKED` or `COMPLETED` appointment SHALL be able to view its
consultation workspace. The workspace includes:
- the appointment time, the participants, the reason, and the symptoms
- the session state with the time of each transition
- a server-assigned video room identifier for the consultation call, not derivable from the
  appointment ID alone
- for the doctor only: the age, medical conditions, allergies, and current medications of whoever
  the appointment is for
No one else MUST be able to view it, and that includes administrators. When the appointment is for
one of the account holder's dependents, the identity and medical summary shown to the doctor are
the dependent's, not the account holder's — the account holder can still open and join the
workspace (they are who is actually signed in), but the doctor is shown who they are actually
treating.

#### Scenario: Participant views the workspace
- **WHEN** the patient of a booked appointment opens its consultation workspace
- **THEN** the response contains the appointment context and the state `SCHEDULED`, and it omits the medical-history summary

#### Scenario: Doctor sees the patient summary
- **WHEN** the doctor of a booked appointment (for the account holder themselves) opens its consultation workspace
- **THEN** the response also includes the account holder's age, medical conditions, allergies, and current medications

#### Scenario: Workspace reflects the dependent
- **WHEN** the doctor of a booked appointment made for one of the patient's dependents opens its consultation workspace
- **THEN** the response shows that dependent's name, age, medical conditions, allergies, and current medications — not the account holder's

#### Scenario: Non-participant denied
- **WHEN** another patient, another doctor, or an administrator requests the workspace
- **THEN** the response is `404` for patients and doctors, and `403` for administrators

#### Scenario: Cancelled appointment
- **WHEN** a participant requests the workspace of a cancelled appointment
- **THEN** the response is `409` with code `APPOINTMENT_NOT_ACTIVE`

#### Scenario: Workspace response includes the video room identifier
- **WHEN** a participant of a booked appointment opens its consultation workspace
- **THEN** the response includes a video room identifier that is not equal to the appointment ID and cannot be computed from it without server-side data

### Requirement: Workspace in the web app
The web app SHALL provide a consultation workspace page for both participants. It shows:
- the appointment context, including who it is for (the account holder or a named dependent)
- a state timeline
- presence indicators
- a countdown until joining opens, when opened too early
- role-appropriate actions: join for both participants; start and complete for the doctor
- for the doctor: the patient summary and the notes and prescriptions editors
- a live video call between the two participants, shown once the session is `IN_PROGRESS`
Patients SHALL see a waiting message until the session starts, and the patient summary and
prescriptions once it is completed. Appointment cards, the appointment detail page, and the
doctor's today list SHALL show a "Join consultation" action while joining is allowed.

#### Scenario: Early visit shows countdown
- **WHEN** a patient opens the workspace 40 minutes before the start
- **THEN** a countdown to when joining opens is shown, and the join action is disabled

#### Scenario: Join action appears in the window
- **WHEN** a patient views their upcoming appointment 10 minutes before the start
- **THEN** a "Join consultation" action is shown and opens the workspace

#### Scenario: Workspace shows the attendee
- **WHEN** the account holder opens the workspace of an appointment booked for one of their dependents
- **THEN** the workspace clearly shows the dependent's name as who the appointment is for

#### Scenario: Video call shown once the consultation starts
- **WHEN** a participant's session is `IN_PROGRESS`
- **THEN** the workspace page shows a live video call using the workspace's assigned room identifier

#### Scenario: No video before the consultation starts or after it completes
- **WHEN** the session is `SCHEDULED`, `JOINED`, or `COMPLETED`
- **THEN** the workspace page does not show a video call

## ADDED Requirements

### Requirement: Video
The consultation workspace SHALL provide a live audio/video call between the patient and the
doctor once the session is `IN_PROGRESS` (the doctor has started the consultation), identified by
a server-assigned room identifier scoped to that appointment. The video call SHALL NOT be offered
merely because a participant has joined the workspace (`JOINED`) — starting the consultation is
what makes the call available, matching "Starting and completing"'s existing doctor-only start
gate. The room identifier SHALL NOT be the raw appointment ID and SHALL NOT be derivable by a
client from the appointment ID or other public metadata alone. Joining the video call SHALL
require no account with the video provider.

This capability is provided by embedding Jitsi Meet's public server (`meet.jit.si`) client-side;
this is a documented exception to this project's standalone-runtime rule, made for prototype
purposes, and SHALL be disclosed in the project's setup/demo documentation as a known external
dependency.

#### Scenario: Video available once the consultation starts
- **WHEN** a participant's session state is `IN_PROGRESS`
- **THEN** they can see and hear the other participant once both have joined the video call

#### Scenario: No video while only joined, not yet started
- **WHEN** the session is `JOINED` (one or both participants have joined the workspace, but the
  doctor has not started the consultation)
- **THEN** no video call is offered

#### Scenario: Video unavailable outside the session window
- **WHEN** the session is `SCHEDULED` or `COMPLETED`
- **THEN** no video call is offered

#### Scenario: Room identifier is not guessable from the appointment ID
- **WHEN** a client has only the appointment ID (for example, from a URL) and no workspace response
- **THEN** it cannot derive the video room identifier without a server-authorized workspace request
