# Tasks

## 1. Data model and service

- [x] 1.1 Add the `Notification` model and enum with a migration; regenerate the Prisma client; verify `pnpm db:migrate` applies cleanly
- [x] 1.2 Implement `NotificationsService.stage`, the `withNotifications` helper, and the recipient rules module; unit tests for each event's drafts (including reschedule not emitting a cancel notification)

## 2. Appointment integration

- [x] 2.1 Wire book, reschedule, and cancel through `withNotifications`; e2e tests "Booking notifies both", "Reschedule notifies both", "Cancellation notifies the other participant", "Failed event creates nothing", plus a forced-rollback atomicity test; verify existing appointment e2e tests still pass

## 3. Reminders

- [x] 3.1 Add `@nestjs/schedule`, `REMINDERS_ENABLED` (false in test env, CI, and OpenAPI generation), and `ReminderService.run(now)` with the cron; unit tests for window selection; e2e tests "24-hour reminder", "1-hour reminder", "No duplicates", "Cancelled appointment", "Short-notice booking"

## 4. Reading API

- [x] 4.1 Implement list, unread count, mark read, and mark all read; e2e tests "List own notifications", "Mark one read", "Mark all read", "Another user's notification", "Signed-out denied" (notifications)
- [x] 4.2 Regenerate the OpenAPI document and client and verify the web package typechecks

## 5. Real-time gateway

- [x] 5.1 Add the socket.io gateway with cookie + Origin + session handshake validation, user rooms, post-commit publish, `notifications:count` pushes, periodic re-validation, and `disconnectSessions` called from every session revocation path; e2e tests "Unauthenticated connection rejected", "Only own events", "Disconnected on sign-out"
- [x] 5.2 Verify through `docker compose up --build` that a socket.io client connects via `http://localhost:8080/socket.io/` (nginx upgrade path) with a session cookie and receives an event

## 6. Web

- [x] 6.1 Add `socket.io-client`, the `RealtimeProvider`, and the fallback polling; Vitest tests "Fallback without a live connection" and toast-on-event with a mocked socket
- [x] 6.2 Build the `NotificationBell` for every role layout and the `/{role}/notifications` pages; Vitest tests "Open a notification" and "Empty state"
- [x] 6.3 Verify manually against `pnpm dev` with two browsers (or via Vitest + socket.io-client scripts if no browser tool is available, stated in the report): "Doctor sees a booking live" — doctor's badge and toast update when a patient books

## 7. Documentation

- [x] 7.1 Add the real-time architecture page/section with the sequence diagram, update module pages, `c4-component.md`, and `docs/index.md`; regenerate the data model page; verify `pnpm docs:build` passes

## 8. Integration check

- [x] 8.1 Run lint, typecheck, unit, e2e, build, docs build, generated-file freshness checks, `openspec validate --all --strict`, and `docker compose down -v && docker compose up --build`; confirm booking produces live notifications through `http://localhost:8080`
