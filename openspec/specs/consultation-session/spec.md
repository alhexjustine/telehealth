# consultation-session Specification

## Purpose
Provides the first-party consultation workspace where a patient and doctor meet at the appointment
time. It shows the appointment context and tracks the session from scheduled to completed, with no
external conferencing service.

## Requirements

### Requirement: Workspace access
The patient and the doctor of a `BOOKED` or `COMPLETED` appointment SHALL be able to view its
consultation workspace. The workspace includes:
- the appointment time, the participants, the reason, and the symptoms
- the session state with the time of each transition
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

### Requirement: Joining
A participant SHALL be able to join the consultation from 15 minutes before the appointment starts
until 30 minutes after it ends, while the appointment is `BOOKED`. The first join by either
participant SHALL move the session from `SCHEDULED` to `JOINED`. Each participant's first join
time SHALL be recorded, and joining again SHALL be allowed and have no further effect.

#### Scenario: Join within the window
- **WHEN** the patient joins 10 minutes before the start
- **THEN** the response is `200`, the session state is `JOINED`, and the patient's join time is recorded

#### Scenario: Too early or too late
- **WHEN** a participant tries to join 20 minutes before the start, or 31 minutes after the end
- **THEN** the response is `409` with code `OUTSIDE_JOIN_WINDOW`

#### Scenario: Rejoin
- **WHEN** a participant who has already joined joins again
- **THEN** the response is `200`, and their recorded first join time is unchanged

### Requirement: Starting and completing
Only the doctor SHALL be able to start or complete a consultation. Starting SHALL be allowed only
from `JOINED` once the patient has joined, and SHALL record the start time. Completing SHALL be
allowed only from `IN_PROGRESS` and only once the consultation note has a patient summary. It
SHALL record the completion time and set the appointment's status to `COMPLETED`. No other
transitions SHALL be possible.

#### Scenario: Doctor starts after the patient joins
- **WHEN** the doctor starts a consultation whose patient has joined
- **THEN** the state becomes `IN_PROGRESS` with the start time recorded

#### Scenario: Patient not yet joined
- **WHEN** the doctor tries to start before the patient has joined
- **THEN** the response is `409` with code `PATIENT_NOT_JOINED`

#### Scenario: Complete with summary
- **WHEN** the doctor completes an in-progress consultation that has a patient summary
- **THEN** the state becomes `COMPLETED`, the appointment status becomes `COMPLETED`, and the completion time is recorded

#### Scenario: Complete without summary
- **WHEN** the doctor tries to complete a consultation that has no patient summary
- **THEN** the response is `409` with code `SUMMARY_REQUIRED` and the state stays `IN_PROGRESS`

#### Scenario: Invalid transition
- **WHEN** the doctor tries to start a completed consultation, or complete one that is only `JOINED`
- **THEN** the response is `409` with code `INVALID_SESSION_TRANSITION`

#### Scenario: Patient cannot control the session
- **WHEN** the patient tries to start or complete the consultation
- **THEN** the response is `403`

### Requirement: Live state and presence
Participants connected to the workspace SHALL receive every state change within 2 seconds, and
SHALL see whether the other participant currently has the workspace open, over the existing
authenticated real-time connection. A client MUST only be able to subscribe to workspaces of
appointments it participates in.

#### Scenario: Patient sees the session start
- **WHEN** the patient has the workspace open and the doctor starts the consultation
- **THEN** the patient's workspace shows `IN_PROGRESS` without reloading

#### Scenario: Presence indicator
- **WHEN** the doctor opens the workspace while the patient already has it open
- **THEN** each participant sees the other shown as present

#### Scenario: Subscribing to someone else's workspace
- **WHEN** a connected user tries to subscribe to the workspace of an appointment they are not part of
- **THEN** the subscription is refused and they receive no events for it

### Requirement: Workspace in the web app
The web app SHALL provide a consultation workspace page for both participants. It shows:
- the appointment context, including who it is for (the account holder or a named dependent)
- a state timeline
- presence indicators
- a countdown until joining opens, when opened too early
- role-appropriate actions: join for both participants; start and complete for the doctor
- for the doctor: the patient summary and the notes and prescriptions editors
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
