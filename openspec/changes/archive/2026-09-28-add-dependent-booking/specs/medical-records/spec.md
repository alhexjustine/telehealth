# Spec Delta

## MODIFIED Requirements

### Requirement: Patient access to own records
A signed-in patient SHALL be able to list the completed consultations of their own account and any
of their dependents, newest first, optionally filtered to just themselves or to one dependent.
Each entry shows the doctor, date, patient summary, and who the consultation was for (the account
holder, or a named dependent). The patient SHALL also be able to view one consultation's full
record: the note fields and prescriptions. A patient MUST NOT see notes or prescriptions of
consultations that are not completed, or that belong to another account.

#### Scenario: Patient lists records
- **WHEN** a patient with two completed consultations and one upcoming appointment lists their records
- **THEN** the two completed consultations are returned, newest first

#### Scenario: Patient lists a dependent's records
- **WHEN** a patient lists their records with no filter, and one completed consultation was for their dependent
- **THEN** that entry is included, shown as being for the dependent

#### Scenario: Filter to one dependent
- **WHEN** a patient filters their records list to one specific dependent
- **THEN** only completed consultations for that dependent are returned

#### Scenario: Draft not visible to patient
- **WHEN** a patient requests the record of a consultation that is still in progress
- **THEN** the response is `404`

#### Scenario: Another patient's record
- **WHEN** a patient requests a record belonging to another account
- **THEN** the response is `404`

### Requirement: Doctor access to patient records
A signed-in doctor SHALL be able to view one specific person's record — the account holder, or one
of their dependents — only while the doctor has at least one `BOOKED` or `COMPLETED` appointment
for that same person. The record contains that person's profile and medical history, the list of
their appointments with this doctor, and their own completed consultation records with any doctor,
for continuity of care. A treating relationship established through the account holder, or through
one dependent, MUST NOT grant access to any other dependent's record, nor to the account holder's
own record — each person's history is scoped independently, even though they share one account.

#### Scenario: Treating doctor views the record
- **WHEN** a doctor with a booked appointment with a patient (for themselves, not a dependent) requests that patient's record
- **THEN** the response contains the patient's own profile, medical history, the appointments between them, and the patient's own completed consultations

#### Scenario: Treating doctor views a dependent's record
- **WHEN** a doctor with a booked appointment for one of a patient's dependents requests that dependent's record
- **THEN** the response contains the dependent's profile, medical history, the appointments between the doctor and that dependent, and that dependent's own completed consultations — not the account holder's or any other dependent's

#### Scenario: No treating relationship
- **WHEN** a doctor whose only appointment with a patient (or one of their dependents) was cancelled, or who never had one, requests that person's record
- **THEN** the response is `404`

#### Scenario: Treating relationship does not cross dependents
- **WHEN** a doctor who has only ever treated one of a patient's dependents requests the account holder's own record, or a different dependent's record
- **THEN** the response is `404`

### Requirement: No administrator access to clinical content
Administrators MUST NOT be able to read consultation notes, prescriptions, or medical history —
the account holder's own or any dependent's — through any endpoint.

#### Scenario: Administrator requests clinical data
- **WHEN** an administrator requests any patient or dependent record, consultation note, or prescription endpoint
- **THEN** the response is `403`

### Requirement: Records in the web app
The patient area SHALL include a records page listing completed consultations for the account
holder and their dependents, filterable by person, with each entry showing who it was for. It SHALL
also include a record detail page showing the patient summary, the findings, assessment, and plan,
and the prescriptions, with a print-friendly layout. The doctor area SHALL include a patient record
page reachable from the doctor's appointments and the workspace, showing whichever person (account
holder or dependent) the doctor's appointment was actually with.

#### Scenario: Patient opens a record
- **WHEN** a patient opens a completed consultation from their records page
- **THEN** the summary, note fields, and prescriptions are shown, and printing produces a clean single-column layout without navigation

#### Scenario: Doctor opens a patient record
- **WHEN** a doctor opens a patient's record from an upcoming appointment that was for the patient themselves
- **THEN** the patient's own medical history and past consultations are shown

#### Scenario: Doctor opens a dependent's record
- **WHEN** a doctor opens a record from an upcoming appointment that was for one of the patient's dependents
- **THEN** that dependent's medical history and past consultations are shown, not the account holder's
