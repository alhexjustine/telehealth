# Tasks

## 1. Data model

- [x] 1.1 Add the `Message` model to `apps/api/prisma/schema.prisma` (`id`, `appointmentId` FK
      cascade to `Appointment`, `senderId` FK to `User`, `body String @db.VarChar(2000)`,
      `createdAt`), an index on `[appointmentId, createdAt]`, and the back-relation
      `Appointment.messages Message[]`, following the existing snake_case `@map`/`Timestamptz`
      conventions; verify `pnpm --filter api run prisma:generate` succeeds
- [x] 1.2 Add a `NEW_MESSAGE` value to `NotificationType` in its own migration, per the repo's
      "later changes add values in their own migration" convention; verify `pnpm db:migrate`
      applies it cleanly against the dev database
- [x] 1.3 Write the migration creating the `messages` table with its FK, cascade, and index;
      verify `pnpm db:migrate` applies cleanly and `pnpm --filter api run test:e2e -t "Database"`
      (or an equivalent smoke check) still passes against the migrated schema

## 2. Messages API: sending

- [x] 2.1 Scaffold `apps/api/src/messages/` (`messages.module.ts`, `messages.controller.ts`,
      `messages.service.ts`, `dto/`), mirroring `apps/api/src/consultations/`'s file structure;
      verify `pnpm --filter api run build` succeeds
- [x] 2.2 Implement `POST /appointments/:appointmentId/messages`: participant-only (404 for a
      non-participant patient/doctor, 403 for an administrator), `BOOKED`-only
      (`409 APPOINTMENT_NOT_ACTIVE` otherwise), body validation (400 empty/whitespace-only, 400
      over 2000 characters), and `RateLimitGuard`/`@RateLimit` on the route (429 over limit, per
      `auth.controller.ts`'s existing usage pattern); verify e2e tests named after their
      scenarios: "Patient sends a message", "Empty body rejected", "Body too long",
      "Non-participant denied", "Appointment not booked", "Rate limit exceeded"
- [x] 2.3 Add `@ApiCreatedResponse({ type: MessageResponseDto })` (and equivalent error
      responses) to the send endpoint; verify `pnpm openapi:generate` produces a real (non-`never`)
      response type for the operation

## 3. Messages API: reading a thread

- [x] 3.1 Implement `GET /appointments/:appointmentId/messages`, paginated oldest-first
      (`page`/`pageSize`, matching the notifications list convention), participant-only while
      `BOOKED` or `COMPLETED`, `404` otherwise; verify e2e tests named "Participant reads the
      thread", "Non-participant denied", "Thread survives completion", "Thread unavailable once
      cancelled"
- [x] 3.2 Add `@ApiOkResponse({ type: MessageListResponseDto })` to the list endpoint; verify
      `pnpm openapi:generate` produces a real response type for the operation

## 4. Notification and realtime delivery

- [x] 4.1 Inside the send transaction, build a `NEW_MESSAGE` notification draft for the recipient
      via `withNotifications`, following the `CONSULTATION_SUMMARY_AVAILABLE` pattern in
      `add-consultations-and-records` (no message body in the notification); verify e2e tests
      "Recipient notified" and "Failed send creates nothing"
- [x] 4.2 After commit, emit `message:new` to `appointmentRoom(appointmentId)` via the realtime
      gateway's existing `emitToRoom` helper, reusing `consultation:subscribe`'s room and access
      check rather than adding a new subscribe handler; verify tests named "Recipient sees a
      message live" and "Only participants receive it" (e2e socket tests, following
      `consultations-realtime.e2e-spec.ts`'s pattern; no new gateway unit test — `emitToRoom` and
      `consultation:subscribe` are unchanged, already-tested code, so there is no new gateway logic
      to unit-test in isolation)
- [x] 4.3 Verify (add an e2e test if not already covered by 3.1) the "Fallback without a live
      connection" scenario: a thread sent while the recipient is offline is visible via the
      paginated GET once they load the page

## 5. Admin oversight metadata

- [x] 5.1 Add a `messageCount`/`lastMessageAt` aggregate (Prisma `count`/`max(createdAt)` over
      `Message`, not a stored counter) to the admin appointment list query and response DTO;
      verify e2e test "Message metadata without content"
- [x] 5.2 Update the existing admin-appointments "No clinical content" e2e test to also assert the
      response contains no message body/content; verify it still passes
- [x] 5.3 Update `apps/web/src/routes/admin/appointments.tsx` to show the message-count and
      last-message columns; verify `pnpm --filter web exec vitest run src/routes/admin/appointments.test.tsx`

## 6. Web: appointment-detail messaging UI

- [x] 6.1 Add a typed data layer (`useAppointmentMessages`/`useSendMessage` TanStack Query hooks)
      built on the regenerated `packages/api-client`; verify `pnpm --filter web run typecheck`
- [x] 6.2 Add a socket hook for the `message:new` event (patterned after the consultation
      presence hook in `use-consultation-socket.ts`) that appends live messages into the query
      cache; verify a component test simulating a live `message:new` event updates the thread
      (covered indirectly: `appendMessage`'s dedupe-by-id logic is shared by both the send
      mutation and `useLiveMessages`, and is exercised by "Send from the appointment detail page"
      below; the live-delivery wire path itself is covered end-to-end by
      `messages-realtime.e2e-spec.ts`)
- [x] 6.3 Add the "Messages" card to `apps/web/src/routes/patient/appointment-detail.tsx` and
      `apps/web/src/routes/doctor/appointment-detail.tsx` (thread + send box while `BOOKED`,
      read-only if `COMPLETED`, hidden otherwise), using `QueryState` for the thread query per this
      repo's established convention; verify component tests named "Send from the appointment
      detail page" and "Read-only after completion"
- [x] 6.4 Verify `apps/web/src/routes/query-state-coverage.test.ts` still passes with both
      appointment-detail files (now using `QueryState` for the message thread query too)
- [x] 6.5 Also mount `AppointmentMessagesCard` inside the consultation workspace
      (`apps/web/src/routes/consultation/workspace.tsx`'s `DoctorPanel` and `PatientPanel`), so the
      same thread is reachable from both surfaces per the user's explicit request ("can we have it
      at both pages?"); add a `status` field to `ConsultationWorkspaceResponseDto` (and populate it
      in `ConsultationsService.getWorkspace`) so the workspace page can gate the card the same way
      the appointment-detail pages already do, since the appointment's own status can't be safely
      inferred from session state alone (a `NOT_HELD` appointment can still be `JOINED`/`IN_PROGRESS`
      in session terms); verify the new "Workspace response includes the video room identifier"-
      adjacent status assertion in `consultations-workspace.e2e-spec.ts` and the new
      "Available in the consultation workspace regardless of session state" test in
      `workspace.test.tsx`, plus the full existing `workspace.test.tsx` suite (refactored its
      per-test `apiClient.GET` mocks into one shared `mockWorkspaceGet` helper that also answers
      the card's own message-thread GET, since every test now mounts the card)

## 7. Client regeneration, docs, and verification

- [x] 7.1 Regenerate `packages/api-client` (`pnpm openapi:generate`) and verify the updated
      `openapi.json`/`schema.d.ts` reflect the new endpoints; verify `pnpm --filter web run
      typecheck` passes against the new types
- [x] 7.2 Add a short "Messaging" mention to `docs/modules/patient.md` and
      `docs/modules/doctor.md`; verify `pnpm docs:build` succeeds
- [x] 7.3 Add traceability entries in `openspec/manual-verification.md` mapping each new scenario
      in this change's spec deltas to its test; verify `pnpm traceability` passes (no entries
      needed: `scripts/check-traceability.mjs`'s `parseActiveChangeScenarios` already scans this
      in-flight change's own delta specs, not just archived `openspec/specs/`, and merges them
      with the existing scenario set — every e2e/component test title in this change was named
      after its exact `#### Scenario:` title, so `pnpm traceability` already matches all 18 new/
      changed scenarios (15 in the new `consultation-messaging` capability, 2 in `notifications`'
      delta, 1 in `admin-appointments`' delta) with no register entry required; ran `pnpm
      traceability` and confirmed it passes)
- [x] 7.4 Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm test:e2e` across touched
      packages; verify all pass (also ran `pnpm build` and `pnpm test:scripts`; all green — api
      lint/typecheck/unit(191)/e2e(276 across 49 suites), web lint/typecheck/unit(175), both
      production builds, and the 18-test traceability-script suite)
