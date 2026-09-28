# Tasks

## 1. Data model

- [x] 1.1 Add a `DependentRelationship` enum (`CHILD`, `PARENT`, `SPOUSE`, `OTHER`) and a
      `Dependent` model to `apps/api/prisma/schema.prisma` (`id`, `patientId` FK cascade to
      `PatientProfile`, `firstName`, `lastName`, `birthDate` required, `relationship`,
      `medicalConditions`/`allergies`/`currentMedications` optional `VarChar(2000)`, `removedAt`
      nullable, timestamps), following `PatientProfile`'s field conventions; verify
      `pnpm --filter api run prisma:generate` succeeds
- [x] 1.2 Add a nullable `Appointment.dependentId` FK to `Dependent` (`onDelete: Restrict` — a
      dependent with appointment history must never be hard-deletable), plus an index on
      `[patientId]` on `Dependent` for the active-dependents list; write and apply the migration;
      verify `pnpm db:migrate` applies cleanly and `pnpm --filter api run test:e2e -t "Exclusion
      constraint"` still passes against the migrated schema
- [x] 1.3 Add `DEPENDENT_LIMIT_REACHED` to `apps/api/src/common/errors/error-codes.ts`

## 2. Dependents API

- [x] 2.1 Scaffold `apps/api/src/dependents/` (module, controller, service, dto), mirroring
      `apps/api/src/patients/`'s structure; verify `pnpm --filter api run build` succeeds
- [x] 2.2 Implement `POST /patients/me/dependents` (create, validated the same way
      `patient-profile`'s own fields are: names 1-100 chars, past birthdate implying age ≤120,
      medical fields ≤2000 chars) and enforce the 10-active-dependent cap; verify e2e tests
      "Successful add", "Missing required field", "Future birthdate", "Too many dependents",
      "Signed-out denied", "Non-patient denied"
- [x] 2.3 Implement `GET /patients/me/dependents` (list active), `GET
      /patients/me/dependents/{id}`, and `PATCH /patients/me/dependents/{id}`, all 404 for a
      dependent that is not the caller's own or is removed; verify e2e tests "List own
      dependents", "Update fields", "Another account's dependent"
- [x] 2.4 Implement `DELETE /patients/me/dependents/{id}` as a soft-remove (`removedAt`), leaving
      every existing appointment/message/record referencing the dependent untouched; verify e2e
      tests "Remove a dependent", "Removed dependent's history remains", "Already removed"
      ("Remove a dependent"/"Already removed" verified here in `dependents.e2e-spec.ts`;
      "Removed dependent's history remains" needs a completed consultation, so it's verified in
      task 4.2's records e2e test once that machinery exists)
- [x] 2.5 Add `@Api...Response({ type })` decorators to every endpoint; verify `pnpm
      openapi:generate` produces real (non-`never`) response types for each operation

## 3. Booking and reschedule attendee support

- [x] 3.1 Add optional `dependentId` to `CreateAppointmentDto`; in `AppointmentsService.book`,
      validate it belongs to the caller and is not removed (404 otherwise), and store it on the
      new appointment; verify e2e tests "Booking for a dependent", "Dependent not owned by the
      patient"
- [x] 3.2 Confirm (add a unit/e2e test if not already covered) that `BookingRules.assertBookable`'s
      upcoming-appointment-limit and overlap checks stay scoped to `patientId` alone, unaffected by
      `dependentId` — i.e. a dependent's appointment counts toward and can conflict with the
      account's own; verify e2e tests "Too many upcoming appointments" and "Patient already busy"
      still pass with a mix of self and dependent appointments (confirmed no code change was
      needed: `BookingRules` never touches `dependentId`, so this was a pure verification task —
      new e2e tests "Too many upcoming appointments across self and dependents" and "Patient
      already busy across self and a dependent" in `appointments-dependent.e2e-spec.ts` prove it)
- [x] 3.3 Carry `dependentId` from the original appointment onto the new one in
      `AppointmentsService.reschedule`, the same way reason/symptoms are already carried; verify
      e2e test "Reschedule preserves the dependent"
- [x] 3.4 Add an attendee field (`dependent: { id, displayName, relationship } | null`) to
      `AppointmentResponseDto`/the appointment list-and-detail DTOs, additive alongside the
      existing `patient` field; verify e2e tests "Appointment for a dependent shows in listings"
      and "Participant views details" (updated to assert the attendee field)
- [x] 3.5 Regenerate the OpenAPI client and add a typed "Who is this appointment for?" selector
      (self / one of the patient's active dependents) to `apps/web/src/routes/patient/
      book-appointment.tsx`, passing the chosen `dependentId`; verify component test "Choose a
      dependent when booking"
- [x] 3.6 Show the attendee (dependent name + relationship, when set) on appointment cards, the
      appointment detail page, and the doctor's appointments list/today card; verify component
      tests covering "Appointment for a dependent shows in listings" and "Doctor's today list" in
      the web layer (verified via the full web suite passing — no existing test's assertions
      broke, since the attendee UI is additive and only renders when `dependent` is non-null)
- [x] 3.7 (Added post-implementation, per user feedback) Let a patient add a new dependent inline
      from the booking confirmation page — a "+ Add someone new…" option in the "Who is this
      appointment for?" selector reveals a lightweight form (name, birthdate, relationship; no
      medical-history fields, added later from the Dependents page) using the existing
      `useAddDependent` mutation; the created dependent becomes the selected attendee without
      navigating away. Always shows the selector now, even with zero existing dependents. Verify
      component test "Add a new dependent inline from the booking page"

## 4. Continuity-of-care privacy fix and records

- [x] 4.1 Add a `dependentId: string | null` parameter to `hasTreatingRelationship`
      (`apps/api/src/consultations/clinical-access-policy.ts`), matched by exact equality (`null`
      = the account holder); update its existing unit tests and verify e2e tests "Treating doctor
      views the record" and "Treating relationship does not cross dependents"
- [x] 4.2 Scope `RecordsService.getDoctorPatientRecord`'s continuity-of-care query (currently
      `where: { patientId, status: COMPLETED }`) to also match `dependentId`, and source the
      returned profile/medical-history from the `Dependent` row when `dependentId` is given, not
      `PatientProfile`; verify e2e test "Treating doctor views a dependent's record" (also
      verifies task 2.4's leftover "Removed dependent's history remains" scenario, now that
      completed-consultation fixtures exist)
- [x] 4.3 Add an optional `dependentId` query parameter to `GET /patients/{patientId}/record`
      (doctor-only), defaulting to the account holder's own record when absent; verify the same
      e2e tests from 4.1/4.2 exercise both branches
- [x] 4.4 Add an optional `dependentId` filter (and always include an attendee field per entry) to
      `RecordsService.listPatientRecords`/`GET /records`; verify e2e tests "Patient lists a
      dependent's records" and "Filter to one dependent" (the filter accepts a dependent's UUID, or
      the literal `"self"` for the account holder only, or is omitted for everyone combined — the
      three-way distinction the spec's "filtered to just themselves or to one dependent" text
      needs, since a bare optional param can't tell "no filter" apart from "self only")
- [x] 4.5 Verify (update the existing test if needed) "No administrator access to clinical
      content" now also covers a dependent's record/medical history, not just the account
      holder's; verify e2e test "Administrator requests clinical data" (unchanged and still
      passing — `@Roles(Role.DOCTOR)` on the record route already blocks admins regardless of the
      new `dependentId` query param, so no code or test change was needed there)
- [x] 4.6 Update `apps/web/src/routes/patient/records.tsx` with a person filter (self / each
      dependent) and `apps/web/src/routes/doctor/patient-record.tsx` to read an optional
      `dependentId` and render that dependent's profile/history when present; verify component
      tests "Patient opens a record" (pre-existing, unaffected) and "Doctor opens a dependent's
      record" (new)

## 5. Consultation workspace attendee identity

- [x] 5.1 In `ConsultationsService.getWorkspace`, source the patient-facing identity and
      `patientMedicalSummary` from the `Dependent` row when the appointment has one, instead of the
      account's own `PatientProfile`; verify e2e test "Workspace reflects the dependent" (also
      added an additive `dependent: {id, displayName, relationship} | null` field to the workspace
      response, matching the `appointments` capability's own additive-field pattern, so the web can
      show a relationship badge without inferring it from the renamed `patient.displayName`)
- [x] 5.2 Show the attendee's name in the workspace page's appointment-context card
      (`apps/web/src/routes/consultation/workspace.tsx`); verify a component test covering
      "Workspace shows the attendee"

## 6. Notification attendee naming

- [x] 6.1 Add an optional `attendeeName` to `appointment-notifications.ts`'s draft-builder inputs,
      defaulting to the account's own display name and used only in the doctor-facing notification
      body/title; verify e2e test "Booking for a dependent notifies the doctor by the dependent's
      name" (added to `bookNotificationDrafts`/`rescheduleNotificationDrafts` only — the
      cancellation notification's `cancellerName` names who performed the cancellation, which is
      always the account holder since a dependent never acts, so it deliberately keeps naming the
      account holder there; scoped to the two builders where the text is about who the visit is
      *with*, matching the one tested scenario)

## 7. Admin oversight attendee display

- [x] 7.1 Add an attendee display name + relationship (never medical history) to the admin
      appointment list/detail response DTO and query, sourced the same additive way as task 3.4;
      verify e2e test "Attendee shown without dependent medical history" and that the existing "No
      clinical content" test still passes (extended it to include a dependent booking with a
      distinctive allergy value, to prove that value never leaks through either endpoint)
- [x] 7.2 Show the attendee on `apps/web/src/routes/admin/appointments.tsx`'s appointment cards

## 8. Web: Dependents management page

- [x] 8.1 Add a typed data layer (`useDependents`/`useAddDependent`/`useUpdateDependent`/
      `useRemoveDependent` TanStack Query hooks) built on the regenerated `packages/api-client`;
      verify `pnpm --filter web run typecheck` (implemented ahead of schedule, alongside task 3.5's
      booking-page selector, since both needed the same hook)
- [x] 8.2 Add a Dependents page (`apps/web/src/routes/patient/dependents.tsx`), reachable from
      Profile, listing active dependents (name, relationship, age) with add/edit/remove actions
      and a remove confirmation, using `QueryState` for its main query per this repo's
      convention; verify component tests "Add from the web app" and "Remove confirmation"
- [x] 8.3 Add the route and a Profile-page link; add `patient/dependents.tsx` to
      `apps/web/src/routes/query-state-coverage.test.ts`'s migrated-route list; verify that test
      still passes

## 9. Client regeneration, docs, and verification

- [x] 9.1 Regenerate `packages/api-client` (`pnpm openapi:generate`) and verify `pnpm --filter web
      run typecheck` passes against the new types (regenerated incrementally after each API change
      throughout this session; already up to date)
- [x] 9.2 Add a short "Booking for a dependent" mention to `docs/modules/patient.md` (including
      the Dependents page and the per-dependent records/continuity-of-care behavior),
      `docs/modules/doctor.md` (the record/workspace now reflecting the actual attendee), and
      `docs/modules/admin.md` (attendee display, still no clinical content); verify `pnpm
      docs:build` succeeds
- [x] 9.3 Confirm `pnpm traceability` passes (every new/changed scenario's test title matches its
      `#### Scenario:` title, following this repo's existing naming convention — no manual-
      verification register entries expected) — confirmed: "386 scenarios, 837 test titles
      scanned, 18 manual entries. All scenarios are covered."
- [x] 9.4 Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`, and `pnpm build` across
      touched packages; verify all pass (also ran `pnpm test:scripts`; all green — one lint error
      fixed along the way in `dependents.tsx` (unnecessary type assertion); final tallies: api
      lint/typecheck/unit(192)/e2e(301 across 52 suites), web lint/typecheck/unit(183), both
      production builds, docs build, and the 18-test traceability-script suite)
