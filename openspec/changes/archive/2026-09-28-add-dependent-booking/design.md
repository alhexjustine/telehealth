# Design

## Context

See `proposal.md` for motivation. Relevant existing pieces this builds on or must not break:

- `PatientProfile` (`apps/api/prisma/schema.prisma`) is the account's own profile — name,
  birthdate (optional), medical-history fields. `Appointment.patientId` is a FK to it, and it is
  the single identity every existing access check (`ClinicalAccessPolicy`, `BookingRules`,
  ownership checks throughout) keys off, because it is the only identity that ever signs in.
- `BookingRules.assertBookable` (`apps/api/src/appointments/booking-rules.ts`) scopes the
  upcoming-appointment limit and the overlap conflict check to `where: { patientId, status: BOOKED,
  ... }` — no other dimension exists today.
- `RecordsService.getDoctorPatientRecord` (`apps/api/src/records/records.service.ts`) and
  `hasTreatingRelationship` (`apps/api/src/consultations/clinical-access-policy.ts`) both key
  purely off `patientId`; the continuity-of-care query
  (`prisma.appointment.findMany({ where: { patientId, status: COMPLETED } })`) currently returns
  every completed consultation for the account, not scoped to which appointment established the
  relationship.
- `ConsultationsService.getWorkspace` (`apps/api/src/consultations/consultations.service.ts`)
  builds the doctor-facing patient identity/summary from the appointment's `patient` relation.
- `apps/api/src/notifications/appointment-notifications.ts`'s draft builders take a
  `Participant { id, displayName }` shape.
- `apps/api/src/admin-appointments/`'s response DTO is built from an explicit field allow-list with
  no clinical content (see its own doc comment).
- `openspec/changes/add-consultation-video/` (in-flight, uncommitted) also modifies
  `consultation-session`'s spec and `ConsultationsService.getWorkspace`/
  `ConsultationWorkspaceResponseDto` (adding a `roomId` field). This change's edits to the same
  method are additive to a different concern (`patientSummary()`/`patientMedicalSummary()`, not
  `roomId`), so a merge should combine mechanically, but both changes touching the same file/
  capability still needs a human check at merge time.

## Goals / Non-Goals

**Goals:**
- Let a patient account add dependents with their own identity and medical history, and book,
  message about (via the already-shipped `add-consultation-messaging`, unchanged), and view
  records for appointments made on a dependent's behalf.
- Fix the continuity-of-care privacy gap this change would otherwise introduce: a doctor's access
  to "this patient's history" must be scoped to the specific person (account holder or one
  dependent) the treating relationship is actually with.
- Keep every existing "who is allowed" check unchanged — only "who this describes" changes.

**Non-Goals:**
- A dependent signing in, or having any account/session of their own.
- Sharing one dependent across two different patient accounts (e.g. both parents), or transferring
  a dependent between accounts.
- Identity/relationship verification (e.g. proof an "OTHER" dependent is really in the account
  holder's care) — self-declared, same trust level as the rest of this prototype's profile data.
- Any change to messaging (`add-consultation-messaging`): a thread stays keyed by appointment, and
  an appointment already carries its attendee, so nothing there needs to change.
- A dependent booking/managing appointments for their own further dependents (no chaining).

## Decisions

**A separate `Dependent` model, not a polymorphic "Person" table.**
`Dependent` mirrors `PatientProfile`'s medical-history shape (conditions/allergies/medications) but
is its own table, owned by `patientId`. Considered unifying account holders and dependents behind
one polymorphic "person" concept so every downstream query only needs one shape — rejected because
it would require rewriting every existing `Appointment.patient`/`PatientProfile` join across the
whole codebase for a bonus feature, and `PatientProfile` also carries account-only concerns
(profile completeness gating booking, emergency contact) that don't apply to a dependent.

**RBAC stays keyed on the account (`Appointment.patientId`); `dependentId` is a display/scoping
attribute, never an auth boundary.**
Every "may this actor act here" check (join, message, cancel, reschedule, manage the booking)
continues to check `actor.id === appointment.patientId`, unchanged. A dependent never has an
`AuthUser`-shaped identity, so it cannot be the subject of an authorization check — only of "whose
record/summary is this."

**Double-booking and the 5-upcoming-appointment limit stay scoped to the account
(`patientId` alone), not per-dependent.**
The account holder is who is physically present at every appointment they book, for themselves or
a dependent, so they cannot be double-booked across their own and a dependent's appointments
either. Scoping the overlap/limit checks per-`(patientId, dependentId)` was considered and rejected
because it would incorrectly let a patient book overlapping appointments for two different
dependents at the same instant — something one person cannot actually attend.

**Soft-remove for `Dependent` (`removedAt DateTime?`), never a hard delete.**
Mirrors this schema's existing avoidance of cascading deletes over historical data. A removed
dependent disappears from the active list and from booking, but every appointment/record naming
them is untouched. Simpler than the `AccountStatus` enum used for user accounts (no admin workflow
applies to a dependent, so a single nullable timestamp is enough).

**Continuity-of-care and `hasTreatingRelationship` gain a `dependentId: string | null` parameter,
matched by exact equality.**
`null` means "the account holder themselves"; a specific ID means that dependent. Prisma matches
`null` as an exact filter value, so "self" and "this dependent" are precise, mutually exclusive
scopes with no new join table. A denormalized `TreatingRelationship` cache table was considered and
rejected as unnecessary machinery at this data scale — the existing on-the-fly query approach
already performs fine and this only adds one more equality clause to it.

**Doctor's patient-record route keeps its existing shape, `GET /patients/{patientId}/record`, plus
an optional `dependentId` query parameter (absent = the account holder's own record).**
Fully backward compatible — every existing link and test targeting a patient's own record keeps
working unchanged. A nested `/patients/{patientId}/dependents/{dependentId}/record` route was
considered and rejected: more conventionally RESTful, but it doubles the route surface for no
behavioral gain, and diverges from this codebase's existing pattern of optional query filters
(e.g. admin appointment oversight's filters) for "the same resource, narrowed."

**Attendee identity is an additive field, not a redefinition of the existing `patient` field.**
Appointment/admin response DTOs gain a new, nullable `dependent: { id, displayName, relationship }`
field alongside the existing `patient` field (still always the account holder). Every existing
consumer that reads `.patient.displayName` keeps working unchanged; new UI additionally renders
`.dependent` when present. Rejected: repointing `patient` itself at "whoever this is for" — would
silently change the meaning of a field every other in-flight and already-shipped feature already
reads.

**Notification attendee naming is an optional override, not a new notification type.**
The existing `Participant`-shaped builder inputs (`bookNotificationDrafts` etc.) gain an optional
`attendeeName` used only for the doctor-facing notification body; the patient's own confirmation
notification is unaffected; the notification's `userId`/routing are unchanged (still the account).

**Explicit product defaults, since the brief doesn't specify them:**
- A dependent's birthdate is *required* (unlike the account's own optional birthdate) — age is
  central to how a doctor reads the workspace/record, so it can't be left unset.
- Relationship is a closed enum: `CHILD`, `PARENT`, `SPOUSE`, `OTHER`.
- An account may have at most 10 active dependents (`DEPENDENT_LIMIT_REACHED`), mirroring this
  schema's other numeric caps (`MAX_UPCOMING_PER_PATIENT`, `MAX_PRESCRIPTIONS_PER_CONSULTATION`).

## Risks / Trade-offs

- **[Risk] Every continuity-of-care and notification-draft call site needs one more parameter
  threaded through.** → Mitigation: additive (an optional/nullable parameter with a "self" default
  of `null`), so no existing call site breaks; only the ones this change touches need updating.
- **[Risk] Two in-flight changes (`add-consultation-video`, this one) both edit
  `ConsultationsService.getWorkspace` and the `consultation-session` capability.** → Mitigation:
  this change's edits are additive to a different section of the method (patient identity/summary,
  not the video room ID); flagged in the proposal so whoever merges applies both and re-runs the
  full consultation-session test suite.
- **[Trade-off] No verification that an "OTHER" dependent is genuinely in the account holder's
  care.** → Accepted: self-declared data is this prototype's existing trust level for the account
  holder's own profile too; real identity verification is out of scope.
- **[Trade-off] A dependent can never message a doctor "as themselves"** — messaging stays between
  the account and the doctor, same as today. → Accepted per Non-Goals: the account holder is who
  is reachable, which matches them being who actually reads/writes on the dependent's behalf.

## Migration Plan

Purely additive: a new `dependents` table and a new nullable `Appointment.dependent_id` column.
Every existing appointment's `dependentId` is implicitly `null` (meaning "the account holder
themselves"), which is exactly its current, unchanged meaning — no backfill needed, no existing
row's observable behavior changes.
