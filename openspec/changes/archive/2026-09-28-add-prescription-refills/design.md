# Design

## Context

`Prescription` rows belong to an `Appointment` and are locked once the appointment/consultation is
`COMPLETED` (`ClinicalAccessPolicy.assertCanWriteRecord` refuses any write once the session state
is `COMPLETED`, enforcing `medical-records`'s "Records lock on completion" requirement). A patient
reads their own record only once it's `COMPLETED` (`assertCanPatientReadRecord`). A doctor's
continuity-of-care access to a patient's (or dependent's) record is gated by
`hasTreatingRelationship(prisma, doctorId, patientId, dependentId)`, keyed on the specific
`(doctorId, patientId, dependentId)` tuple — a relationship through one dependent does not extend
to another dependent or to the account holder. Notifications are written with
`NotificationsService.stage` inside the same transaction as the triggering write, via the
`withNotifications` helper, then published post-commit (see `notifications`'s design.md,
"Transactional write, post-commit publish" — same document set, reused unchanged here).

## Goals / Non-Goals

**Goals:**
- Let a patient ask for a prescription renewal, and the treating doctor decide it, without a new
  appointment.
- Reuse the existing clinical-access and notification machinery exactly, rather than building a
  parallel authorization or notification path.
- Never touch a locked consultation note or prescription row.

**Non-Goals:**
- Real e-prescribing, pharmacy routing, or dosage/medication editing workflows.
- A general "edit history" or amendment feature for completed records — this is scoped
  specifically to refill requests.
- Admin visibility into refill requests (their notes count as clinical content; `medical-records`
  already keeps administrators out of clinical content, and this follows the same line).

## Decisions

### New model: `PrescriptionRefillRequest`, not a mutation of `Prescription`/`ConsultationNote`

```prisma
enum RefillRequestStatus {
  PENDING
  APPROVED
  DENIED
}

model PrescriptionRefillRequest {
  id             String              @id @default(uuid()) @db.Uuid
  prescriptionId String              @map("prescription_id") @db.Uuid
  requestedById  String              @map("requested_by_id") @db.Uuid
  patientNote    String?             @db.VarChar(500)
  status         RefillRequestStatus @default(PENDING)
  doctorNote     String?             @db.VarChar(500)
  decidedById    String?             @map("decided_by_id") @db.Uuid
  decidedAt      DateTime?           @map("decided_at") @db.Timestamptz(3)
  createdAt      DateTime            @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt      DateTime            @updatedAt @map("updated_at") @db.Timestamptz(3)

  prescription Prescription @relation(fields: [prescriptionId], references: [id], onDelete: Cascade)
  requestedBy  User         @relation("RefillRequestedBy", fields: [requestedById], references: [id], onDelete: Cascade)
  decidedBy    User?        @relation("RefillDecidedBy", fields: [decidedById], references: [id], onDelete: SetNull)

  @@index([prescriptionId])
  @@index([status])
}
```

- `requestedById` is always the signed-in account's `User.id` (never the dependent — a dependent
  has no login), matching the proposal's "only the requesting account can see its own requests."
  Which specific person (account holder or dependent) the request is about is derived, not stored
  again: it's whatever `dependentId` the prescription's appointment already has. This mirrors how
  `Prescription` itself has no `patientId`/`doctorId` columns and is always reached through its
  `Appointment`.
- **Rejected**: storing `patientId`/`doctorId`/`dependentId` directly on the request for
  query convenience. Rejected because it duplicates data already reachable via
  `prescription.appointment`, and a duplicate copy can drift from the source of truth; the extra
  join is cheap at this table's expected size (bounded by prescriptions per patient, not a
  high-volume table).
- `decidedById` is technically always equal to the prescription's appointment's `doctorId` (only
  the treating doctor can decide), so it's redundant for authorization — but it's kept anyway as an
  explicit, denormalized audit trail of "who actually clicked approve/deny and when," consistent
  with this codebase's existing audit-log conventions elsewhere (`admin_audit_log`), even though
  this table isn't part of that same log.
- No DB-level partial-unique constraint enforcing "at most one `PENDING` request per prescription."
  **Rejected** a hand-written exclusion/partial-unique-index migration (the pattern used for
  appointment-overlap prevention) as overkill here: unlike appointment overlap, there's no
  concurrent-double-booking race to close — a patient's own duplicate-request click is fully
  serialized behind their own request, so an application-level check-then-create inside the same
  transaction (`RefillsService.request`, following `RecordsService.addPrescription`'s
  count-then-create shape for `MAX_PRESCRIPTIONS_PER_CONSULTATION`) is sufficient and consistent
  with how most other business-rule limits in this codebase are enforced.

### Approving does not reopen the record or create a new prescription

Two alternatives were considered and rejected for "the existing prescription was renewed":

1. **Reopen the original `ConsultationNote`/`Prescription` for editing.** Rejected: directly
   violates `medical-records`'s "Records lock on completion" requirement (`RECORD_LOCKED`), which
   exists so a completed record is an immutable account of what happened during that consultation.
   A refill decided weeks later is not part of that consultation.
2. **Auto-create a new `Prescription` row on the same (completed) appointment**, timestamped at
   approval. Rejected: it fabricates a prescription entry that reads as if the doctor wrote it
   during that consultation, when they didn't — misleading for anyone reading the record later,
   and it would need its own carve-out in the "locked" rule.

Instead, the `PrescriptionRefillRequest` row itself — its `status`, `doctorNote`, and `decidedAt` —
**is** the renewal record, shown inline next to the original prescription on the record-detail
page (`RecordDetailResponseDto`'s prescription entries gain a `refillRequests: RefillRequestDto[]`
field, newest first). This satisfies "add a note that the existing prescription was renewed"
without inventing a dosing/medication-entry workflow, and without touching anything locked.

### Access control: reuse `hasTreatingRelationship`, not a new policy

- **Request** (patient): gate with the same rule the existing record-detail read already uses —
  `ClinicalAccessPolicy.assertCanPatientReadRecord(actor, appointment)` against the prescription's
  parent appointment. If the patient can already read that record, they can request a refill on
  it; no new check is needed.
- **List / decide** (doctor): gate with `hasTreatingRelationship(prisma, doctorId, patientId,
  dependentId)` against the prescription's parent appointment's `(patientId, dependentId)` — the
  exact same helper `RecordsService.getDoctorPatientRecord` already uses, so the per-dependent
  isolation `medical-records` already guarantees carries over with no new logic to get wrong.
  `list` filters to appointments where `doctorId` matches the signed-in doctor directly (a doctor
  only ever sees their own queue, never queries someone else's).
- A `RefillsAccessPolicy` is **not** introduced as a new abstraction; the two existing checks above
  are reused directly in `RefillsService`, keeping one source of truth for clinical access.

### API surface

Following the existing `doctors/me/...` (self-scoped) and `POST .../:id/<verb>` (state-transition
action) conventions used elsewhere (`doctors/me/availability`, `admin/appointments/:id/cancel`):

- `POST /records/:appointmentId/prescriptions/:prescriptionId/refill-requests` (Roles: PATIENT) —
  body `{ patientNote?: string }`.
- `GET /doctors/me/refill-requests?status=PENDING` (Roles: DOCTOR) — `status` optional, defaults to
  all.
- `POST /doctors/me/refill-requests/:id/approve` (Roles: DOCTOR) — body `{ doctorNote?: string }`.
- `POST /doctors/me/refill-requests/:id/deny` (Roles: DOCTOR) — body `{ doctorNote?: string }`.

`RecordDetailResponseDto`'s existing `prescriptions` field switches from `PrescriptionResponseDto[]`
to a new `RecordPrescriptionDto[]` (which extends the same fields, plus `refillRequests`), scoped
to `records/dto/record-response.dto.ts` only — `PrescriptionResponseDto` itself (used by the live
consultation-editing endpoints) is untouched.

### Notifications

Two new drafts follow the existing `appointment-notifications.ts` draft-builder pattern exactly
(pure functions, no I/O): `refillRequestedNotificationDraft` (to the doctor) and
`refillDecidedNotificationDraft` (to the patient — the `requestedById` account, not the dependent,
since the dependent has no login). Both link to `/doctor/refill-requests` and
`/patient/records/:appointmentId` respectively, wired through `withNotifications` inside
`RefillsService`'s `request`/`approve`/`deny` methods, same shape as `MessagesService.send`.

## Risks / Trade-offs

- **[Risk] A doctor could accumulate an unbounded refill-request queue with no pagination.** →
  Mitigation: `GET /doctors/me/refill-requests` is paginated the same way every other list endpoint
  in this codebase is (`page`/`pageSize`, default page size matching `records`'s
  `DEFAULT_RECORD_PAGE_SIZE` convention).
- **[Risk] A patient could request a refill for every prescription on every old record as a way to
  message the doctor.** → Mitigation: the one-`PENDING`-request-per-prescription rule bounds this
  to "at most one open request per prescription," which is an acceptable, self-limiting ceiling for
  a prototype; a rate limit is out of scope here (this is a data-shape thing, not a per-IP abuse
  vector like the existing `rate-limit.guard.ts` covers).
- **[Trade-off] `decidedById` duplicates information derivable from the prescription's appointment.**
  Accepted for audit clarity (see "Decisions" above); it costs one denormalized column, not a new
  authorization path.

## Documentation to update

- `docs/modules/patient.md` and `docs/modules/doctor.md` — new refill-request flow in each
  module's feature list.
- `docs/architecture/data-model.md` and `docs/architecture/_generated-erd.md` — the new
  `prescription_refill_requests` table (the ERD file is regenerated; confirm the generator picks
  up the new model).
- `docs/architecture/clinical-access.md` — note that refill-request access reuses
  `hasTreatingRelationship`/`assertCanPatientReadRecord` rather than introducing a new policy.
- API reference (`docs/api/index.md`): regenerated automatically from the OpenAPI doc
  (`pnpm openapi:generate`) once the new controller/DTOs exist; no hand-written changes expected
  beyond that.
