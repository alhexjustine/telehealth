# Spec Delta

## Purpose

Stores the outcome of each consultation (the doctor's notes and prescriptions) and lets patients
and treating doctors read a patient's records under strict role-based access, with no clinical
access for administrators.

## ADDED Requirements

### Requirement: Consultation notes
The doctor of an appointment SHALL be able to create and update its consultation note while the
session is `JOINED` or `IN_PROGRESS`. The note consists of findings, assessment, plan, and a
patient summary, each optional text of at most 4000 characters. Saving SHALL replace the note's
fields and record the update time.

#### Scenario: Doctor saves a draft note
- **WHEN** the doctor saves findings and a plan during an in-progress consultation
- **THEN** the response is `200` with the saved note

#### Scenario: Note before joining
- **WHEN** the doctor tries to save a note while the session is still `SCHEDULED`
- **THEN** the response is `409` with code `SESSION_NOT_ACTIVE`

#### Scenario: Patient cannot write notes
- **WHEN** the patient of the appointment tries to save a note
- **THEN** the response is `403`

### Requirement: Prescriptions
The doctor of an appointment SHALL be able to add, update, and remove prescriptions while the
session is `JOINED` or `IN_PROGRESS`. Each prescription SHALL have:
- medication: required, at most 120 characters
- dosage: required, at most 60 characters
- frequency: required, at most 60 characters
- duration: required, at most 60 characters
- instructions: optional, at most 500 characters
A consultation MUST NOT have more than 20 prescriptions.

#### Scenario: Add a prescription
- **WHEN** the doctor adds "Amoxicillin", "500 mg", "3 times a day", "7 days" during an in-progress consultation
- **THEN** the response is `201` with the prescription

#### Scenario: Missing required field
- **WHEN** the doctor adds a prescription without a dosage
- **THEN** the response is `400` naming the dosage field

### Requirement: Records lock on completion
Once a consultation is `COMPLETED`, its note and prescriptions MUST NOT be created, changed, or
removed by anyone.

#### Scenario: Edit after completion
- **WHEN** the doctor tries to update the note or a prescription of a completed consultation
- **THEN** the response is `409` with code `RECORD_LOCKED` and nothing changes

### Requirement: Patient access to own records
A signed-in patient SHALL be able to list their completed consultations, newest first. Each entry
shows the doctor, date, and patient summary. The patient SHALL also be able to view one
consultation's full record: the note fields and prescriptions. A patient MUST NOT see notes or
prescriptions of consultations that are not completed, or that belong to another patient.

#### Scenario: Patient lists records
- **WHEN** a patient with two completed consultations and one upcoming appointment lists their records
- **THEN** the two completed consultations are returned, newest first

#### Scenario: Draft not visible to patient
- **WHEN** a patient requests the record of a consultation that is still in progress
- **THEN** the response is `404`

#### Scenario: Another patient's record
- **WHEN** a patient requests a record belonging to another patient
- **THEN** the response is `404`

### Requirement: Doctor access to patient records
A signed-in doctor SHALL be able to view a patient's record only while the doctor has at least one
`BOOKED` or `COMPLETED` appointment with that patient. The record contains the patient's profile,
medical history, the list of their appointments with this doctor, and the patient's completed
consultation records with any doctor, for continuity of care.

#### Scenario: Treating doctor views the record
- **WHEN** a doctor with a booked appointment with a patient requests that patient's record
- **THEN** the response contains the patient's profile, medical history, the appointments between them, and the patient's completed consultations

#### Scenario: No treating relationship
- **WHEN** a doctor whose only appointment with a patient was cancelled, or who never had one, requests that patient's record
- **THEN** the response is `404`

### Requirement: No administrator access to clinical content
Administrators MUST NOT be able to read consultation notes, prescriptions, or patient medical
history through any endpoint.

#### Scenario: Administrator requests clinical data
- **WHEN** an administrator requests any patient record, consultation note, or prescription endpoint
- **THEN** the response is `403`

### Requirement: Records in the web app
The patient area SHALL include a records page listing completed consultations. It SHALL also
include a record detail page showing the patient summary, the findings, assessment, and plan, and
the prescriptions, with a print-friendly layout. The doctor area SHALL include a patient record
page reachable from the doctor's appointments and the workspace.

#### Scenario: Patient opens a record
- **WHEN** a patient opens a completed consultation from their records page
- **THEN** the summary, note fields, and prescriptions are shown, and printing produces a clean single-column layout without navigation

#### Scenario: Doctor opens a patient record
- **WHEN** a doctor opens a patient's record from an upcoming appointment
- **THEN** the patient's medical history and past consultations are shown
