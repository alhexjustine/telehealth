# Tasks

## 1. Data model

- [x] 1.1 Add `ConsultationSession`, `ConsultationNote`, `Prescription`, the `SessionState` enum, and the `CONSULTATION_SUMMARY_AVAILABLE` notification type with a migration; regenerate the Prisma client; verify `pnpm db:migrate` applies cleanly

## 2. Domain logic

- [x] 2.1 Implement the pure `transition` state machine and window constants; unit tests for every branch and the exact window edges
- [x] 2.2 Implement `ClinicalAccessPolicy`; unit tests for every branch (participant, cancelled, locked, not active, treating relationship with booked/completed/cancelled-only appointments, admin)

## 3. Consultation API

- [x] 3.1 Implement workspace GET and join; e2e tests "Participant views the workspace", "Doctor sees the patient summary", "Non-participant denied" (workspace), "Cancelled appointment", "Join within the window", "Too early or too late", "Rejoin"
- [x] 3.2 Implement start and complete (row lock, appointment `COMPLETED`, patient notification via `withNotifications`); e2e tests "Doctor starts after the patient joins", "Patient not yet joined", "Complete with summary", "Complete without summary", "Invalid transition", "Patient cannot control the session", "Patient notified on completion"

## 4. Records API

- [x] 4.1 Implement the note upsert and prescription CRUD with locking; e2e tests "Doctor saves a draft note", "Note before joining", "Patient cannot write notes", "Add a prescription", "Missing required field", "Edit after completion", plus the 20-prescription limit
- [x] 4.2 Implement patient records list/detail and the doctor patient-record endpoint; e2e tests "Patient lists records", "Draft not visible to patient", "Another patient's record", "Treating doctor views the record", "No treating relationship", "Administrator requests clinical data"
- [x] 4.3 Regenerate the OpenAPI document and client and verify the web package typechecks

## 5. Real-time workspace

- [x] 5.1 Add `consultation:subscribe` with the access check, per-room presence tracking, and post-commit `consultation:state` emits; e2e socket tests "Patient sees the session start", "Presence indicator", "Subscribing to someone else's workspace"

## 6. Web

- [x] 6.1 Build `/consultations/:appointmentId` (context, timeline, presence, countdown, auto-join, doctor patient summary, autosaving notes editor, prescriptions table, start/complete with guards, patient waiting and completed views); Vitest tests "Early visit shows countdown", Start disabled until the patient joins, Complete disabled without summary, and a mocked state event updating the patient view
- [x] 6.2 Add "Join consultation" actions to patient and doctor appointment cards, detail pages, and the doctor today list; Vitest test "Join action appears in the window"
- [x] 6.3 Build `/patient/records`, `/patient/records/:appointmentId` (print layout), and `/doctor/patients/:patientId`; Vitest tests "Patient opens a record" and "Doctor opens a patient record"
- [x] 6.4 Verify the full core journey manually against `pnpm dev` with two browsers (or via Vitest + API/socket scripts if no browser tool is available, stated in the report): patient books → both join → doctor starts → writes note and prescription → completes → patient gets the notification and views the record

## 7. Documentation

- [x] 7.1 Update Patient and Doctor module pages (overviews, L2 flow, data model, state-machine diagram), add the records access section, update `c4-component.md` and `docs/index.md`; regenerate the data model page; verify `pnpm docs:build` passes

## 8. Integration check

- [x] 8.1 Run lint, typecheck, unit, e2e, build, docs build, generated-file freshness checks, `openspec validate --all --strict`, and `docker compose down -v && docker compose up --build`; confirm the full core journey through `http://localhost:8080` (inserting an appointment that starts within the join window directly via SQL, since normal booking needs a 60-minute lead time)
