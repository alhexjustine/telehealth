# Proposal

## Why

A patient choosing between doctors today has only specialization, experience, and availability to
go on — nothing reflects how past patients actually felt about a visit. Letting a patient rate and
comment on a doctor after a completed consultation gives future patients a second, independent
signal, and gives administrators a lightweight way to notice a doctor worth a closer look, without
standing up any kind of external reputation or review platform.

## What Changes

- After a consultation reaches `COMPLETED`, the account holder who booked it (whoever it was
  for — themselves or a dependent) can leave a 1-5 star rating and an optional comment for the
  treating doctor, once per appointment. They can edit their own rating/comment later; there is no
  separate "delete my review" action in this pass.
- A doctor's public discovery card and profile show an average rating and review count, computed
  only from visible (non-hidden) reviews. This is **purely an informational, additional signal** —
  it does not feed the deterministic specialty-matching algorithm and is not part of the default
  search sort (soonest slot first, unchanged). Patients MAY explicitly choose a "highest rated"
  sort, alongside the existing name/experience sorts, entirely opt-in.
- Administrators gain a review-moderation queue: list all reviews (including hidden ones, unlike
  the patient/public view), and hide or unhide a review with a required reason, the same
  reason-required pattern already used for account status changes and doctor rejection. A hidden
  review disappears from the public list and the average/count immediately; it stays visible, with
  its reason, in the admin queue. Hiding and unhiding are each audited, like every other
  administrator action.
- No external SaaS/BaaS/runtime API is introduced. Reviews are plain PostgreSQL rows managed
  through the existing NestJS + Prisma stack, reusing the app's own auth, roles, and audit log; no
  new dependency.
- Modules affected: **Patient** (leaving/editing a review), **Doctor** (discovery: rating shown to
  patients evaluating them — a doctor does not get a separate moderation ability over their own
  reviews), and **Admin** (moderation queue, audit log). The **Product Website** module is not
  affected.

## Capabilities

### New Capabilities
- `doctor-reviews`: a patient account's ability to rate/comment on a completed consultation's
  doctor, the public (non-hidden) view of a doctor's reviews and aggregate rating, and the
  administrator's moderation (hide/unhide) of individual reviews.

### Modified Capabilities
- `doctor-discovery`: search results and the doctor profile page gain an average rating and review
  count, and search gains an opt-in "highest rated" sort.
- `audit-log`: the enumerated list of audited administrator actions gains hiding and unhiding a
  review.

## Impact

- `apps/api/prisma/schema.prisma`: new `DoctorReview` model — one row per `Appointment`
  (`appointmentId` unique, so "once per appointment, editable" falls out of an upsert rather than a
  separate uniqueness check), `rating` (1-5, enforced by a check constraint the same way other
  bounded values are), optional `comment`, and soft-hide fields (`hiddenAt`/`hiddenById`/
  `hiddenReason`) mirroring the account-status-change reason pattern rather than a hard delete, so
  a hidden review stays available to the admin queue and the audit trail. New `AuditAction` values
  `REVIEW_HIDDEN`/`REVIEW_UNHIDDEN`.
- `apps/api/src/reviews/` (new module): a patient-facing controller
  (`PUT /appointments/:id/review` upsert, `GET /appointments/:id/review` to read back the caller's
  own review, `GET /doctors/:id/reviews` for the public, paginated, visible-only list) and an
  admin-facing controller (`GET /admin/reviews`, `POST /admin/reviews/:id/hide`,
  `POST /admin/reviews/:id/unhide`). Eligibility to write a review reuses the exact predicate
  `ClinicalAccessPolicy.assertCanPatientReadRecord` already uses (own appointment, `COMPLETED`) —
  see design.md for why this is scoped per-appointment rather than reusing the relationship-level
  `hasTreatingRelationship` check.
- `apps/api/src/doctor-discovery/` (or wherever the search/profile query lives): joins the
  non-hidden average/count onto each result and the profile response; adds a `rating` sort option.
- `apps/api/src/audit/`: extend the audit-writing call sites for the two new admin actions,
  following the same "same transaction as the action" rule as every other audited action.
- **Known overlap with another in-flight, uncommitted change**: `openspec/changes/
  add-doctor-favorites/` also modifies the `doctor-discovery` capability's spec (adding a
  favorite/star affordance to the same search cards and profile page). Both changes touch the same
  spec file, the same doctor-card component, and likely the same response DTOs — they need to be
  reconciled at merge time, called out here the same way `add-dependent-booking` flagged its own
  overlap with `add-consultation-video` on `consultation-session`.
- Web: a "Rate this visit" prompt/form on a completed appointment (patient area), a rating +
  review-count badge and optional review list on doctor cards/profile (patient area), and a new
  "Reviews" moderation page in the admin area, following the existing admin list-plus-action-dialog
  pattern (`apps/web/src/routes/admin/`).
- `packages/api-client`: regenerate (`pnpm openapi:generate`) after the new endpoints land.
- Docs: `docs/modules/patient.md` and `docs/modules/doctor.md` gain a short mention of leaving/
  seeing reviews; `docs/modules/admin.md` gains the moderation queue.
