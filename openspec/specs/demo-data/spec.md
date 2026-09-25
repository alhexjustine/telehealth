# demo-data Specification

## Purpose
Gives reviewers and demo presenters a realistic, entirely fictional dataset. It loads with the
local stack, so every module can be explored immediately, and it comes with commands to stage a
live consultation and to remove the demo data cleanly.

## Requirements

### Requirement: Automatic demo dataset
When the `DEMO_DATA` setting is `true` (the default in the local Docker Compose stack), the
system SHALL load the demo dataset on startup after migrations and administrator provisioning.
Loading SHALL be idempotent: when the demo dataset is already present, startup MUST leave it
unchanged. When `DEMO_DATA` is not `true`, no demo data SHALL be loaded.

#### Scenario: First startup loads demo data
- **WHEN** the stack starts for the first time with default configuration
- **THEN** the demo accounts exist and the demo patient can sign in with the documented password

#### Scenario: Restart leaves demo data unchanged
- **WHEN** the stack restarts with demo data already present
- **THEN** no duplicate demo records are created and changes made during a previous session are kept

#### Scenario: Disabled
- **WHEN** the stack starts with `DEMO_DATA=false` against an empty database
- **THEN** only the administrator account exists

### Requirement: Demo dataset contents
The demo dataset SHALL be entirely fictional, and every demo account MUST use an email address in
the reserved domain `demo.telehealth.local`. All demo accounts SHALL share one documented demo
password. The dataset SHALL contain at least:
- 8 approved doctors whose specializations together cover at least 8 catalog specializations,
  each with a weekly schedule, and at least one of them in a time zone other than the others
- 1 pending doctor, 1 rejected doctor with a review note, and 1 suspended doctor
- a primary demo patient with a complete profile and medical history, a patient under 18, a
  patient with an incomplete profile, and a suspended patient
- for the primary demo patient: at least 2 completed consultations with notes and prescriptions,
  at least 2 upcoming booked appointments, 1 cancelled appointment, and 1 rescheduled pair
- at least one invalid booking of each kind for administrators to resolve
- unread notifications for the primary demo patient and the primary demo doctor
- audit entries for the administrator actions that the dataset implies (approval, rejection,
  suspension)
Appointment times SHALL be relative to the time the dataset is loaded.

#### Scenario: Doctor search is populated
- **WHEN** the demo patient opens Find a doctor after startup
- **THEN** at least 8 doctors are listed, most with an available slot within 14 days

#### Scenario: Records are populated
- **WHEN** the demo patient opens their records
- **THEN** at least two completed consultations with notes and prescriptions are shown

#### Scenario: Admin has work to do
- **WHEN** the administrator opens the dashboard after startup
- **THEN** at least one pending review and at least one invalid booking are shown

### Requirement: Live consultation command
The system SHALL provide a command that creates, or replaces, a booked appointment between the
primary demo patient and the primary demo doctor, starting 10 minutes after the command runs,
bypassing the normal booking lead time. The command MUST only affect demo accounts.

#### Scenario: Stage a live consultation
- **WHEN** a presenter runs the live consultation command
- **THEN** the demo patient and demo doctor can join that appointment's consultation workspace immediately

#### Scenario: Run twice
- **WHEN** the command runs again later
- **THEN** the previous staged appointment is replaced so there is only one, and no other appointments are affected

### Requirement: Demo data reset
The system SHALL provide a command that removes every demo account and all records owned by them,
leaving non-demo accounts and data intact, so the dataset can be reloaded cleanly.

#### Scenario: Reset keeps real data
- **WHEN** the reset command runs in a database that contains demo data and a non-demo patient with an appointment
- **THEN** all demo accounts and their records are gone, and the non-demo patient and their appointment remain
