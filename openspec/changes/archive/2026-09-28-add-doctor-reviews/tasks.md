# Tasks

## 1. Data model

- [x] 1.1 Add `DoctorReview` model to `apps/api/prisma/schema.prisma` (`appointmentId` unique FK to
      `Appointment`, `doctorId`/`patientId` denormalized for indexing, `rating` (small int),
      optional `comment` (`VarChar(1000)`), `hiddenAt`/`hiddenById`/`hiddenReason`, timestamps) and
      add `REVIEW_HIDDEN`/`REVIEW_UNHIDDEN` to `AuditAction`; verify
      `pnpm --filter api run prisma:generate` succeeds
- [x] 1.2 Write the migration, including a hand-written `CHECK (rating BETWEEN 1 AND 5)` constraint
      (Prisma's schema language can't express it, same pattern as the existing appointment overlap
      exclusion constraints); verify `pnpm db:migrate` applies cleanly against a fresh database
- [x] 1.3 Add `REVIEW_NOT_ELIGIBLE` and `REVIEW_HIDE_STATUS_UNCHANGED` to
      `apps/api/src/common/errors/error-codes.ts`; verify the API builds

## 2. Patient-facing review API

- [x] 2.1 Create `apps/api/src/reviews/` module with `PUT /appointments/:id/review` (upsert on
      `appointmentId`); verify "Leave a review after completion" and "Edit an existing review"
      e2e tests pass
- [x] 2.2 Gate the endpoint with `ClinicalAccessPolicy.assertCanPatientReadRecord`'s predicate;
      verify "Not the account's own appointment" (404) and "Signed-out denied" (401) e2e tests pass
- [x] 2.3 Reject a non-`COMPLETED` appointment with `409 REVIEW_NOT_ELIGIBLE`; verify "Not yet
      completed" e2e test passes for `BOOKED`, `CANCELLED`, and `NOT_HELD`
- [x] 2.4 Validate `rating` (integer 1-5) and `comment` (optional, ≤1000 chars, trimmed empty to
      `undefined` like other optional text fields in this codebase) on the DTO; verify "Rating out
      of range" and "Comment too long" e2e tests pass
- [x] 2.5 Add `GET /appointments/:id/review` returning the caller's own review or 404 if none, under
      the same eligibility gate; verify a unit/e2e test for both the present and absent cases

## 3. Public reviews + aggregate API

- [x] 3.1 Add `GET /doctors/:id/reviews` (paginated, newest first, visible-only, no reviewer
      identity in the response); verify "List visible reviews" and "Hidden review excluded" e2e
      tests pass
- [x] 3.2 Compute the average rating and visible review count via a `GROUP BY doctorId` aggregate
      filtered on `hiddenAt IS NULL`; verify "No reviews yet" (absent average, zero count) e2e test
      passes
- [x] 3.3 Verify "Signed-out denied" (401) e2e test passes for the reviews list endpoint

## 4. Doctor-discovery integration

- [x] 4.1 Join the visible-only average rating and review count onto doctor search results and the
      doctor profile response; verify "Rating shown when reviews exist", "No reviews yet" (search),
      "Hidden reviews excluded from search results", and "Profile rating reflects only visible
      reviews" e2e tests pass
- [x] 4.2 Add an opt-in `rating` sort option (highest first, no-reviews doctors last, ties broken by
      display name), leaving the default sort and specialty-matching logic untouched; verify "Sort
      by rating" e2e test passes
- [x] 4.3 Regenerate the API client: `pnpm openapi:generate`; verify `packages/api-client` builds

## 5. Admin moderation API + audit

- [x] 5.1 Create an admin reviews controller: `GET /admin/reviews` (filter by doctor and hidden
      status), `POST /admin/reviews/:id/hide`, `POST /admin/reviews/:id/unhide`, each requiring a
      5-500 character reason; verify "Hide a review", "Unhide a review", and "Missing reason" e2e
      tests pass
- [x] 5.2 Reject a redundant hide/unhide with `409 REVIEW_HIDE_STATUS_UNCHANGED`; verify "Redundant
      hide" e2e test passes
- [x] 5.3 Restrict all three endpoints to `Role.ADMIN`; verify "Non-admin denied" e2e test passes
- [x] 5.4 Write `AuditLog` entries (`REVIEW_HIDDEN`/`REVIEW_UNHIDDEN`) in the same transaction as
      the hide/unhide, excluding the review's comment text from `before`/`after`; verify "Review
      hidden audited" and "Review unhidden audited" e2e tests pass
- [x] 5.5 Regenerate the API client: `pnpm openapi:generate`; verify `packages/api-client` builds

## 6. Web: patient review UI

- [x] 6.1 Add a "Rate this visit" prompt/form on a completed appointment's detail view, using
      `PUT /appointments/:id/review` and prefilling from `GET /appointments/:id/review` when a
      review already exists; verify a component test for both create and edit paths
- [x] 6.2 Surface validation errors (rating required, comment length) inline; verify a component
      test for the rejected-submission path

## 7. Web: doctor-discovery UI

- [x] 7.1 Show average rating + review count (or "No reviews yet") on doctor search cards and the
      doctor profile page, using `QueryState` for the reviews list per `apps/web/src/routes/
      query-state-coverage.test.ts`'s convention; verify a component test for both states
- [x] 7.2 Add "Highest rated" to the sort selector on the Find a doctor page; verify a component
      test that selecting it updates the URL and re-fetches with the new sort

## 8. Web: admin moderation UI

- [x] 8.1 Add a "Reviews" page in the admin area: list with doctor/hidden-status filters, and a
      hide/unhide action dialog requiring a reason, following the existing admin list-plus-
      action-dialog pattern; verify a component test for hiding and unhiding a review

## 9. Docs

- [x] 9.1 Update `docs/modules/patient.md` and `docs/modules/doctor.md` with a short mention of
      leaving/seeing reviews; update `docs/modules/admin.md` with the moderation queue; verify
      `pnpm docs:build` succeeds

## 10. Verification

- [x] 10.1 Run `pnpm --filter api run test`, `pnpm --filter api run test:e2e`, `pnpm --filter web
       run test`, `pnpm lint`, and `pnpm typecheck` across the workspace; verify all pass. All pass
       except one pre-existing, unrelated flake: `appointments-book.e2e-spec.ts`'s "Concurrent
       bookings of the same slot" fails only under the full e2e suite's load (passes reliably in
       isolation, both alone and rerun) — a timing-sensitive exclusion-constraint race test, not
       touched by this change.
- [x] 10.2 Run `pnpm traceability` and verify every scenario in this change's spec deltas maps to a
       named test. Every `doctor-reviews`/`doctor-discovery`/`audit-log` scenario this change adds
       or modifies has a matching test; the command still exits non-zero because two sibling
       in-flight proposals (`add-doctor-favorites`, `add-prescription-refills`) have spec deltas
       with no implementation yet — unrelated to this change.
