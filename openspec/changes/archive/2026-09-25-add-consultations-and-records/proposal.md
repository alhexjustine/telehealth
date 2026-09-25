# Proposal

## Why

This closes the core journey. At the appointment time, the patient and doctor meet in a
consultation workspace. The doctor then records findings and prescriptions, and the patient can
review them later. The brief requires a first-party workspace that shows appointment context and
tracks scheduled, joined, in-progress, and completed states, plus medical records stored in
PostgreSQL with role-based access enforced by NestJS. Audio and video are explicitly not required.

## What Changes

- **Consultation workspace:** one per appointment, shared by patient and doctor.
  - It moves through `SCHEDULED` → `JOINED` → `IN_PROGRESS` → `COMPLETED`.
  - Participants join from 15 minutes before the start until 30 minutes after the end.
  - The doctor starts the session once the patient has joined.
  - The doctor completes it once a patient summary is written, which also marks the appointment
    `COMPLETED`.
  - State changes and who is currently present are pushed live to both participants over the
    existing real-time connection.
- **Consultation notes:** findings, assessment, plan, and a patient summary. Doctors draft them
  during the session.
- **Prescriptions:** medication, dosage, frequency, duration, and instructions. Doctors add, edit,
  and remove them during the session.
- Notes and prescriptions lock when the consultation is completed.
- **Medical records:**
  - Patients view their completed consultations, with notes and prescriptions, in a
    print-friendly view.
  - Doctors view a patient's profile, medical history, and completed consultation records, but
    only while they have a booked or completed appointment with that patient.
  - Administrators have no access to clinical content.
- **Notification:** the patient receives "Consultation summary available" when a consultation is
  completed.
- **Web:**
  - the consultation workspace page, with "Join" entry points on appointment cards, details, and
    the doctor's today list
  - patient records pages
  - a doctor patient-record page
- **Documentation:** module pages, the consultation state machine diagram, the records access
  rules, L3 components, and the regenerated data model.

No external SaaS, BaaS, conferencing, or records service is introduced. No new runtime
dependencies are expected.

**Product modules affected:** Patient (joining, records) and Doctor (running consultations, notes,
prescriptions, patient records). Admin is affected only through the explicit denial of clinical
access.

## Capabilities

### New Capabilities
- `consultation-session`: The workspace, its join window and state machine, presence and live
  state, completion, and the workspace web page.
- `medical-records`: Consultation notes and prescriptions, their editing and locking rules, and
  who can read patient records, plus the records web pages.

### Modified Capabilities
- `notifications`: Adds the "Consultation summary available" notification to the patient on
  completion.

## Impact

- API: new `consultations` and `records` modules. The realtime gateway gains per-appointment
  rooms. The appointment status is set to `COMPLETED` by consultation completion.
- Database: new `consultation_sessions`, `consultation_notes`, and `prescriptions` tables, and a
  new notification type.
- Web: `/consultations/:appointmentId`, `/patient/records`, `/patient/records/:appointmentId`,
  `/doctor/patients/:patientId`, and join buttons in the existing appointment views.
- The generated API client and the docs are regenerated.
