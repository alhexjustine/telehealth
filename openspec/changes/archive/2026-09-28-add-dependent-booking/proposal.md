# Proposal

## Why

Today an account can only book, message about, and view records for consultations attended by
itself — there is no way for a patient to manage healthcare for a child, an elderly parent, or a
spouse who won't have (or shouldn't need) their own login. Booking on behalf of a family member is
a normal part of how households actually use a telehealth product, and it is a natural extension
of the existing patient account rather than a separate feature area.

## What Changes

- A patient account can add **dependents** — people it books on behalf of (child, parent, spouse,
  or other), each with their own name, birthdate, relationship, and medical history (conditions,
  allergies, current medications), tracked separately from the account holder's own profile and
  from each other. A dependent has no login of their own; the account holder does everything on
  their behalf (booking, joining the consultation, messaging, viewing records).
- Booking an appointment gains an optional "who is this for" choice: the account holder themselves,
  or one of their dependents. The chosen dependent is carried through rescheduling.
- The consultation workspace, medical records, notifications, and admin oversight all show *who
  the appointment is for* (the dependent's name/age, not the account holder's) wherever that's
  what a doctor or administrator needs to see — while every access-control check (who may join,
  message, cancel, or manage the booking) still keys off the **account**, since that's who is
  actually signed in.
- **Continuity-of-care privacy fix, made necessary by this change**: a doctor's view of a patient's
  medical history currently returns *all* of that patient account's completed consultations,
  regardless of which appointment established the treating relationship. Once one account can
  represent several distinct people (the holder plus any number of dependents), this must narrow to
  the specific person (account holder, or one specific dependent) the doctor actually has a
  treating relationship with — otherwise a doctor who has only ever treated a patient's child would
  also see that patient's own unrelated consultations, or another dependent's.
- No external SaaS/BaaS/runtime API is introduced. Dependents are plain PostgreSQL rows managed
  through the existing NestJS + Prisma stack; no new dependency.
- Modules affected: **Patient** (dependent management, booking, records, messaging context) and
  **Doctor** (workspace/record continuity now reflects the actual attendee). **Admin** is touched
  only for oversight display (an attendee name/relationship, never dependent medical history — the
  same non-disclosure rule already applied to the account holder's own clinical content). The
  **Product Website** module is not affected.

## Capabilities

### New Capabilities
- `patient-dependents`: a patient account's management of the people (besides itself) it books
  for — add/list/view/update/remove, each with its own medical-history fields, owned exclusively
  by the account.

### Modified Capabilities
- `appointments`: booking (and the reschedule it carries forward) gains an optional dependent
  attendee; list/detail responses surface who the appointment is for.
- `medical-records`: the doctor's "patient record" continuity-of-care view and the patient's own
  completed-consultations list become scoped per (account, dependent) rather than per account
  alone — the privacy fix described above.
- `consultation-session`: the workspace's patient-facing identity and medical summary (age,
  conditions, allergies, medications) reflect the dependent, not the account holder, when the
  appointment is for one.
- `notifications`: the doctor-facing appointment-event notifications name the actual attendee
  (the dependent) instead of the account holder, when applicable.
- `admin-appointments`: the oversight list/detail gains an attendee display name and relationship,
  with the same "no clinical content" guarantee already applied to the account holder.

## Impact

- `apps/api/prisma/schema.prisma`: new `Dependent` model (owned by `PatientProfile.userId`, with
  the same medical-history shape as `PatientProfile`, plus a required `birthDate` and a
  `relationship` enum, and a soft-remove timestamp rather than a hard delete so appointment/record
  history is never orphaned), and a new nullable `Appointment.dependentId` FK.
- `apps/api/src/dependents/` (new module): CRUD under the signed-in patient, mirroring
  `apps/api/src/patients/`'s profile-validation conventions.
- `apps/api/src/appointments/`: `CreateAppointmentDto` gains an optional `dependentId`;
  `AppointmentsService.book`/`reschedule` validate it belongs to the caller and carry it onto the
  new appointment (reschedule copies it, the same way it already copies the reason and symptoms);
  response DTOs gain the attendee's identity. The existing double-booking/upcoming-appointment-
  limit checks stay scoped to the **account** (`patientId` alone) across every dependent combined —
  the account holder is who is physically present, so they cannot be double-booked across their own
  and a dependent's appointments either.
- `apps/api/src/records/` and `apps/api/src/consultations/clinical-access-policy.ts`:
  `hasTreatingRelationship` and the continuity-of-care query both gain a `dependentId` dimension
  (see the privacy-fix bullet above); the patient's own records list can be filtered by dependent.
- `apps/api/src/consultations/consultations.service.ts`: `getWorkspace`'s patient identity/medical
  summary is sourced from the `Dependent` row when the appointment has one.
- `apps/api/src/notifications/appointment-notifications.ts`: draft builders gain an "attendee name"
  distinct from the account's own display name.
- `apps/api/src/admin-appointments/`: response DTO gains an attendee display name + relationship,
  never dependent medical history, mirroring the account holder's own existing non-disclosure rule.
- **Known collision with another in-flight, uncommitted change**: `openspec/changes/
  add-consultation-video/` also modifies the `consultation-session` capability's spec and
  `ConsultationsService.getWorkspace`/`ConsultationWorkspaceResponseDto` (to add a video room
  identifier). This change touches the same capability and the same service method (to source the
  patient identity/summary from the dependent). Both changes need to be reconciled at merge time —
  called out here the same way `add-consultation-messaging` flagged its own (smaller) overlap risk
  with that change.
- Web: a new "Dependents" management page in the patient area; a "Who is this appointment for?"
  selector on the booking page; appointment cards/detail, the patient's records page, and the
  doctor's patient-record page all show/filter by attendee.
- `packages/api-client`: regenerate (`pnpm openapi:generate`) after the new endpoints/DTOs land.
- Docs: `docs/modules/patient.md` and `docs/modules/doctor.md` gain a short mention; `docs/modules/
  admin.md` notes the attendee-display-only oversight addition.
