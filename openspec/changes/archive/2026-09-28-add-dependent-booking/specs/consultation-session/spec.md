# Spec Delta

## MODIFIED Requirements

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
