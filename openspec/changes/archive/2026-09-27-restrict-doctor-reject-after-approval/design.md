# Design

## Context

See proposal.md - Why. Today's guard lives entirely in `AdminDoctorsService.decide()`
(`apps/api/src/admin-doctors/admin-doctors.service.ts:193-250`), the shared implementation behind
both `approve()` and `reject()`: it only throws when the requested status equals the doctor's
current status (`STATUS_UNCHANGED`, 409). Neither the API nor the admin UI otherwise restricts
which status a decision may start from. The frontend button-disabled logic in
`apps/web/src/routes/admin/doctor-detail.tsx:138-153` mirrors that: Approve disabled only on
`APPROVED`, Reject disabled only on `REJECTED`.

## Goals / Non-Goals

**Goals:**
- Reject is only accepted when the doctor's current verification status is `PENDING`.
- The failure mode is a distinct, stable error code the frontend can react to precisely, matching
  the existing `STATUS_UNCHANGED` pattern.
- Approve's existing behavior (valid from `PENDING` or `REJECTED`) is unchanged.

**Non-Goals:**
- Changing anything about suspend/deactivate (`admin-users` capability) — they already do what an
  admin needs to pull an approved doctor out of service.
- Changing how invalid-booking detection works (`admin-appointments`) — a `REJECTED` doctor with
  an upcoming booking is already handled by that capability's generic "doctor not visible to
  patients" detection, and can still occur (e.g. via direct data manipulation, or a doctor rejected
  while `PENDING` who is later manually re-associated with an appointment in a non-standard way);
  this proposal doesn't need to touch that requirement.
- Reworking the demo dataset: `apps/api/scripts/seed/build-dataset.ts` constructs its
  `dr.rejected` fixture and its `DOCTOR_UNAVAILABLE` invalid-booking example by writing
  `verificationStatus`/appointment rows directly via Prisma, not by calling the reject endpoint, so
  this rule change doesn't affect it.

## Decisions

- **Guard placement**: add the new check inside `decide()` rather than duplicating it in
  `reject()` before calling `decide()`. `decide()` already loads the doctor row inside the
  transaction (`admin-doctors.service.ts:207`) right where `STATUS_UNCHANGED` is checked; adding a
  second condition there keeps both guards in one place and inside the same transaction, avoiding
  a duplicate (and potentially racy, if checked outside the transaction) fetch.
  - *Alternative considered*: check `verificationStatus` in `reject()` before calling `decide()`.
    Rejected because it either re-fetches the doctor outside the transaction (a race between the
    check and the update) or forces `decide()`'s signature to accept an already-loaded doctor,
    complicating the shared path `approve()` also uses.
- **New error code name**: `INVALID_VERIFICATION_TRANSITION`, following the existing
  `INVALID_SESSION_TRANSITION` naming (consultation sessions) rather than a bespoke name like
  `CANNOT_REJECT_APPROVED_DOCTOR`. Keeps the "the requested transition isn't legal from this
  state" family of codes consistent, and reads naturally if a future change ever restricts an
  approve-side transition too.
  - *Alternative considered*: reuse `STATUS_UNCHANGED` for this case too. Rejected: the doctor's
    status is not unchanged (target `REJECTED` differs from current `APPROVED`), and the frontend
    needs to distinguish "no-op, nothing to do" from "this action isn't allowed at all" to show the
    right message.
- **Scope of the guard**: only `reject()` gets the new restriction; `approve()` keeps accepting
  `PENDING` or `REJECTED` as valid starting points (re-review after an earlier rejection stays
  possible). This matches the proposal's ask precisely — approve is not part of the complaint.
- **Frontend**: change the Reject button's `disabled` condition from
  `verificationStatus === 'REJECTED'` to `verificationStatus !== 'PENDING'`
  (`doctor-detail.tsx:149`), so it also covers `APPROVED`. The reject confirmation dialog's submit
  handler (`confirmReject`, `doctor-detail.tsx:107-117`) already surfaces the mutation's thrown
  error via `toast.error`, so no new error-handling path is needed there — only the button's
  disabled state and the Swagger-documented 409 response change.

## Risks / Trade-offs

- [Existing e2e tests or other callers might implicitly rely on rejecting an approved doctor] →
  Checked: `apps/api/test/admin-doctors.e2e-spec.ts`'s only reject-path tests ("Reject with a
  note", "Reject without a note", "Same decision twice") all reject from `PENDING`; none reject an
  `APPROVED` doctor. No existing test breaks.
- [`packages/api-client`'s generated types go stale] → Mitigated by a task to regenerate the
  OpenAPI client after the new `@ApiResponse` is added to the controller.

## Migration Plan

No data migration. This is a pure business-rule tightening with no schema change; deploying it
only changes the response to a request pattern (`reject` on an `APPROVED` doctor) that had no
sanctioned use before. Rollback is a plain revert of the guard, controller docs, and frontend
`disabled` condition.
