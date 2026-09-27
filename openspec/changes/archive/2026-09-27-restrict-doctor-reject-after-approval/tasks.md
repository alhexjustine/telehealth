# Tasks

## 1. API error code and service guard

- [x] 1.1 Add `INVALID_VERIFICATION_TRANSITION` to `apps/api/src/common/errors/error-codes.ts`, following the existing `INVALID_SESSION_TRANSITION` naming and doc-comment style
- [x] 1.2 In `AdminDoctorsService.decide()` (`apps/api/src/admin-doctors/admin-doctors.service.ts`), after the existing `STATUS_UNCHANGED` check, add a guard that throws `DomainError(HttpStatus.CONFLICT, ErrorCode.INVALID_VERIFICATION_TRANSITION, ...)` when the requested status is `REJECTED` and the doctor's current status is `APPROVED`; verify via the new "Cannot reject an approved doctor" e2e test in task 2.1
- [x] 1.3 Add `@ApiResponse({ status: 409, description: 'INVALID_VERIFICATION_TRANSITION', type: ErrorResponseDto })` to the `reject` handler in `apps/api/src/admin-doctors/admin-doctors.controller.ts`; verify by regenerating the OpenAPI client (task 4.1) and confirming the new response appears in `packages/api-client/openapi.json`

## 2. API tests

- [x] 2.1 Add "Cannot reject an approved doctor" to `apps/api/test/admin-doctors.e2e-spec.ts`: approve a doctor, then attempt reject with a valid note, and assert `409` with `code: 'INVALID_VERIFICATION_TRANSITION'` and that the doctor's `verificationStatus` is still `APPROVED` on a follow-up `GET`; verify with `pnpm --filter api run test:e2e -t "Cannot reject an approved doctor"`
- [x] 2.2 Extend "Failed action not audited" (same file) to also cover the new rejection path: after the failed reject attempt in 2.1, assert no `DOCTOR_REJECTED` audit entry exists for that doctor; verify with the same test run as 2.1

## 3. Admin web UI

- [x] 3.1 In `apps/web/src/routes/admin/doctor-detail.tsx`, change the Reject button's `disabled` condition from `data.verificationStatus === 'REJECTED'` to `data.verificationStatus !== 'PENDING'`; verify with a new `apps/web/src/routes/admin/doctor-detail.test.tsx` covering the "Reject disabled for an approved doctor" scenario (render with a mocked `useAdminDoctor` returning `verificationStatus: 'APPROVED'`, assert the Reject button is disabled) alongside a control case for `PENDING` (assert it is enabled)
- [x] 3.2 Run `pnpm --filter web exec vitest run src/routes/admin/doctor-detail.test.tsx` and confirm both cases pass

## 4. Client regeneration and full verification

- [x] 4.1 Run `pnpm openapi:generate` to regenerate `packages/api-client` with the new 409 response and verify the generated `schema.d.ts` includes `INVALID_VERIFICATION_TRANSITION` in the reject operation's documented responses
- [x] 4.2 Run `pnpm --filter api run lint`, `pnpm --filter api run typecheck`, `pnpm --filter web run lint`, `pnpm --filter web run typecheck` and confirm all pass
- [x] 4.3 Run `pnpm --filter api run test:e2e -t "Admin doctor review"` and `pnpm --filter web exec vitest run src/routes/admin/doctor-detail.test.tsx` and confirm all pass
- [x] 4.4 Run `pnpm exec openspec validate --strict` for `restrict-doctor-reject-after-approval` and confirm it passes before archiving

## 5. Full-suite regression found after apply

Task 4.3 only ran the "Admin doctor review" test filter, which doesn't cover other suites that
happened to reject an already-approved doctor as their own setup step. A later full-suite run
(`pnpm --filter api run test:e2e`, no filter) caught two:

- [x] 5.1 Fix `admin-appointments.e2e-spec.ts`'s "Upcoming appointment with a rejected doctor" (renamed "…with a suspended doctor") and "Cancel an invalid upcoming appointment", and `admin-dashboard.e2e-spec.ts`'s "Counts reflect the data": each built its invalid-booking fixture by rejecting an already-approved doctor, which this change now forbids (409). Suspend the doctor's account instead (`POST /admin/users/:id/status`), which still trips `DOCTOR_UNAVAILABLE` via its "account not active" branch; verify with `pnpm --filter api run test:e2e` (full suite, unfiltered) — 249/249 pass
