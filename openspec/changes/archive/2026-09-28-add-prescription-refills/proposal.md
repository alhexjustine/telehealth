# Proposal

## Why

A patient whose prescription is running out currently has no way to ask for a renewal without
booking (and paying for, in a real deployment) an entirely new consultation. Letting them request
a refill of a prescription from a past, completed consultation — and letting the treating doctor
approve or deny it from a queue — closes a real gap in the core "book -> consult -> get a
prescription" journey with a small, self-contained workflow.

## What Changes

- A patient can request a refill of any prescription on one of their own (or their dependents')
  completed consultation records, with an optional short note (e.g. "still have symptoms, appointment
  is 3 weeks out").
- The treating doctor for that record — the doctor of the appointment the prescription belongs to
  — sees pending refill requests in a new queue and approves or denies each one, with an optional
  note of their own. Approving does **not** reopen or edit the original (locked) consultation note
  or create a new prescription entry; it records the decision alongside the existing prescription,
  which is the "this was renewed" record. See design.md for why this shape was chosen over
  reopening the record.
- The patient sees the request's status (pending/approved/denied) and the doctor's note, if any,
  next to that prescription on their existing record detail page.
- The doctor receives an in-app notification when a new refill request comes in; the patient
  receives one when it's decided.
- A patient can only request a refill for a prescription that they, or that specific dependent, can
  currently read on the account (a completed record they have access to). A doctor can only see
  and decide requests for prescriptions from an appointment where they are the treating doctor of
  that same patient/dependent pair.
- No external SaaS/BaaS/runtime API is introduced. This stays a first-party, in-app request/decision
  workflow, backed by the existing PostgreSQL database and the existing in-app notification
  infrastructure — not real e-prescribing, not a pharmacy integration.
- Modules affected: **Patient** (request a refill, see its status) and **Doctor** (a refill-request
  queue, approve/deny). Product Website and Admin are unaffected — administrators already cannot
  read clinical content, and a refill request's patient/doctor notes count as clinical content, so
  it stays outside the Admin console by design.

## Capabilities

### New Capabilities
- `prescription-refills`: patients requesting a refill of a past prescription; the treating doctor
  approving or denying each request; access scoped to the same patient/dependent pair that
  established the treating relationship in the first place.

### Modified Capabilities
- `notifications`: two new appointment-adjacent notification types — "Refill requested" (to the
  doctor) and "Refill request approved"/"Refill request denied" (to the patient) — created in the
  same transaction as the triggering action, following the existing "system SHALL create
  notifications ... in the same database transaction as the event" pattern.

## Impact

- **Database**: one new table (`prescription_refill_requests`), one new enum
  (`RefillRequestStatus`), migrated with Prisma; a new `NotificationType` value pair.
- **API** (`apps/api`): a new `refills` module (service + controller) reusing
  `ClinicalAccessPolicy`/`hasTreatingRelationship` for access control and the existing
  `withNotifications`/`NotificationsService` pattern for notifications; `RecordsService`/
  `RecordDetailResponseDto` extended so a prescription's refill-request history is visible on the
  existing patient record-detail response; `packages/api-client`'s generated OpenAPI types are
  regenerated.
- **Web** (`apps/web`): the patient record-detail page (`apps/web/src/routes/patient/
  record-detail.tsx`) gets a "Request refill" action and status display per prescription; a new
  doctor-facing "Refill requests" page and nav item (mirroring the existing `doctor/appointments`
  nav pattern) for the approve/deny queue.
- **Docs**: `docs/architecture/*` (Patient and Doctor module pages, data model) and the OpenAPI
  reference need updating for the new endpoints and table.
