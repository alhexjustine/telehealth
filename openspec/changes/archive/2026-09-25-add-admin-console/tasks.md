# Tasks

## 1. Audit foundation

- [x] 1.1 Add the `AuditLog` model, `AuditAction` enum, and the append-only trigger migration; regenerate the Prisma client; e2e test "Database blocks changes"
- [x] 1.2 Add request context via `AsyncLocalStorage` (request ID, IP, user agent), `AuditService.record(tx, …)`, and `diffFields`; unit tests for `diffFields` allow-listing
- [x] 1.3 Write the `ADMIN_SIGNED_IN` entry in the admin sign-in transaction; e2e test "Admin sign-in audited"

## 2. Schema additions

- [x] 2.1 Add `NOT_HELD` to `AppointmentStatus`, the resolution reason field, and the `PROFILE_APPROVED`/`PROFILE_REJECTED`/platform-cancellation notification types in a migration; verify existing tests still pass

## 3. Shared domain refactors

- [x] 3.1 Extract `AppointmentsService.cancelInTx` and route patient, doctor, and admin cancellation through it with cancellation-kind-aware notifications; verify existing appointment and notification e2e tests still pass
- [x] 3.2 Add the re-review rule to the doctor self-update; e2e tests "Credential change triggers re-review", "Other edits keep approval", and the existing doctor-profile scenarios

## 4. Admin users

- [x] 4.1 Implement `GET /admin/users`; e2e tests "Filter by role and status", "Text query", "Non-admin denied" (accounts)
- [x] 4.2 Implement status change with session revocation, deactivation cancellations, notifications, and audit; e2e tests "Suspend a patient", "Deactivate a doctor with bookings", "Reactivate", "Missing reason", "Admin account protected", "No-op change", "Status change audited", "Deactivation lists cancelled appointments", "Deactivation notifies the counterpart only", plus an atomicity test

## 5. Doctor review

- [x] 5.1 Implement the review queue and full-profile endpoints; e2e tests "Pending queue", "Full profile for review", "Non-admin denied" (review)
- [x] 5.2 Implement approve/reject with notifications and audit; e2e tests "Approve a pending doctor", "Reject with a note", "Reject without a note", "Same decision twice", "Doctor notified of approval", "Doctor notified of rejection", "Failed action not audited"
- [x] 5.3 Implement admin doctor profile edits with shared validation and audit; e2e tests "Correct a specialization", "Invalid admin edit"

## 6. Appointment oversight

- [x] 6.1 Implement the shared invalid-booking query builders and `GET /admin/appointments` with filters and the clinical-content allow-list; unit tests for the flag conditions; e2e tests "Filter by date and status", "No clinical content", "Non-admin denied" (oversight), "Past appointment never completed", "Upcoming appointment with a rejected doctor"
- [x] 6.2 Implement admin cancel and mark-not-held with notifications and audit; e2e tests "Cancel an invalid upcoming appointment", "Cancel without reason", "Cancel an ended appointment", "Resolve a stale appointment", "Not eligible", "Admin cancellation notifies both"

## 7. Dashboard and audit viewer

- [x] 7.1 Implement `GET /admin/dashboard`; unit test for the time-zone bucket math; e2e tests "Counts reflect the data", "Daily buckets in the admin's time zone", "Non-admin denied" (dashboard)
- [x] 7.2 Implement `GET /admin/audit` and `/admin/audit/{id}` (read-only); e2e tests "Filter by affected record", "Non-admin denied" (audit), "No API to change entries"
- [x] 7.3 Regenerate the OpenAPI document and client and verify the web package typechecks

## 8. Web

- [x] 8.1 Build the admin dashboard with stat tiles and the accessible SVG trend chart; Vitest test "Tile links to work queue"
- [x] 8.2 Build `/admin/users` with the status dialog; Vitest test "Deactivation warning"
- [x] 8.3 Build `/admin/doctors` and `/admin/doctors/:doctorId`; Vitest test "Approve from the review page"
- [x] 8.4 Build `/admin/appointments`; Vitest test "Invalid-only view"
- [x] 8.5 Build `/admin/audit` with the diff sheet and cross-links from users, doctors, and appointments; Vitest test "Diff view"
- [x] 8.6 Verify manually against `pnpm dev` (or via Vitest + curl if no browser tool is available, stated in the report): approve a pending doctor → they appear in patient search; suspend a signed-in patient in another browser → they are signed out; each action appears in the audit log

## 9. Documentation

- [x] 9.1 Update `docs/modules/admin.md` fully, `c4-component.md`, `auth.md`, and `docs/index.md`; regenerate the data model page; verify `pnpm docs:build` passes

## 10. Integration check

- [x] 10.1 Run lint, typecheck, unit, e2e, build, docs build, generated-file freshness checks, `openspec validate --all --strict`, and `docker compose down -v && docker compose up --build`; confirm the admin can approve a doctor and see it audited through `http://localhost:8080`
