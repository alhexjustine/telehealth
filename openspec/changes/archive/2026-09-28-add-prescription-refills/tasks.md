# Tasks

## 1. Data model

- [x] 1.1 Add `RefillRequestStatus` enum and `PrescriptionRefillRequest` model to
      `apps/api/prisma/schema.prisma` (see design.md's "New model" for the exact shape), add the
      `RefillRequestedBy`/`RefillDecidedBy` back-relations on `User`, add two `NotificationType`
      values (`REFILL_REQUESTED`, `REFILL_DECIDED`), generate a migration
      (`pnpm --filter api exec prisma migrate dev`), and verify `pnpm --filter api run
      prisma:generate` succeeds with no schema errors.
- [x] 1.2 Add `ErrorCode.REFILL_REQUEST_ALREADY_PENDING` and `ErrorCode.REFILL_REQUEST_NOT_PENDING`
      to `apps/api/src/common/errors/error-codes.ts` and verify `pnpm --filter api run typecheck`
      passes.

## 2. Refills module (API)

- [x] 2.1 Create `apps/api/src/refills/dto/` with `RequestRefillDto` (`patientNote?: string`, max
      500), `DecideRefillDto` (`doctorNote?: string`, max 500), `RefillRequestResponseDto`, and
      `RefillRequestListResponseDto` (paginated, matching `RecordListResponseDto`'s
      `items/total/page/pageSize` shape); verify `class-validator` decorators reject an
      over-length note with a `400`.
- [x] 2.2 Add `refillRequestedNotificationDraft`/`refillDecidedNotificationDraft` to
      `apps/api/src/notifications/appointment-notifications.ts` (or a sibling file if that one's
      appointment-specific naming doesn't fit — follow whichever reads more naturally once 2.3 is
      written) and unit tests in the existing
      `apps/api/src/notifications/appointment-notifications.spec.ts` style verifying the recipient,
      title, body, and link for each of request/approve/deny.
- [x] 2.3 Create `apps/api/src/refills/refills.service.ts`: `request(actor, appointmentId,
      prescriptionId, dto)` (gated by `ClinicalAccessPolicy.assertCanPatientReadRecord`, rejects a
      second `PENDING` request with `REFILL_REQUEST_ALREADY_PENDING`), `listForDoctor(doctorId,
      status?, page, pageSize)`, `approve(doctorId, id, dto)` and `deny(doctorId, id, dto)` (both
      gated by `hasTreatingRelationship` against the prescription's appointment, reject a
      non-`PENDING` request with `REFILL_REQUEST_NOT_PENDING`), each wrapped in `withNotifications`
      per design.md's "Notifications" section.
- [x] 2.4 Create `apps/api/src/refills/refills.controller.ts` exposing:
      `POST /records/:appointmentId/prescriptions/:prescriptionId/refill-requests` (Roles:
      PATIENT), `GET /doctors/me/refill-requests` (Roles: DOCTOR),
      `POST /doctors/me/refill-requests/:id/approve` and `.../deny` (Roles: DOCTOR), each with
      `@ApiOkResponse`/`@ApiCreatedResponse({ type })` per the CLAUDE.md Swagger gotcha; register
      `RefillsModule` (controller + service, importing `NotificationsModule`) in
      `apps/api/src/app.module.ts`.
- [x] 2.5 Add `apps/api/test/refills.e2e-spec.ts` covering every scenario in
      `specs/prescription-refills/spec.md` and the two new scenarios in `specs/notifications/
      spec.md`, named after their scenarios (e.g. "Patient requests a refill", "Duplicate pending
      request", "Not the treating doctor", "Dependent's refill request is isolated", "Doctor
      notified of a new request"); verify `pnpm --filter api run test:e2e -- refills` passes.

## 3. Records integration

- [x] 3.1 Add `RefillRequestDto` and `RecordPrescriptionDto` (extends the existing prescription
      fields plus `refillRequests: RefillRequestDto[]`) to
      `apps/api/src/records/dto/record-response.dto.ts`; change `RecordDetailResponseDto.
      prescriptions` to `RecordPrescriptionDto[]`.
- [x] 3.2 Update `RecordsService.getPatientRecord` to load each prescription's refill requests
      (newest first) and map them into `RecordPrescriptionDto`; extend
      `apps/api/test/records-notes-prescriptions.e2e-spec.ts` (or a new
      `records-refills.e2e-spec.ts`, matching the existing `records-access.e2e-spec.ts`/
      `records-dependent.e2e-spec.ts` split) with "Patient sees a pending request" and "Patient sees
      a decided request"; verify the updated/new e2e file passes.
- [x] 3.3 Run `pnpm openapi:generate` and verify `packages/api-client`'s generated
      `openapi.json`/`schema.d.ts` include the new endpoints and DTOs with no manual edits needed.

## 4. Web: patient refill request

- [x] 4.1 Add `apps/web/src/lib/refills/use-refills.ts` with a `useRequestRefill(appointmentId,
      prescriptionId)` mutation (invalidating that record-detail query on success, following
      `apps/web/src/lib/records/use-records.ts`'s existing query-key pattern).
- [x] 4.2 Update `apps/web/src/routes/patient/record-detail.tsx`: each prescription gets a "Request
      refill" button (hidden while a `PENDING` request already exists for it) opening a small
      inline note field, and shows the latest refill request's status/note beneath the
      prescription when one exists; verify by extending
      `apps/web/src/routes/patient/record-detail.test.tsx` with "Request a refill" and "Pending
      request hides the button" cases.

## 5. Web: doctor refill queue

- [x] 5.1 Add `apps/web/src/lib/refills/use-doctor-refills.ts` with `useDoctorRefillRequests(status?)`,
      `useApproveRefill()`, `useDenyRefill()`.
- [x] 5.2 Create `apps/web/src/routes/doctor/refill-requests.tsx`: a list of pending requests (patient/
      dependent name, medication, patient's note, appointment date) with approve/deny actions each
      opening a small note field, using `QueryState` per the CLAUDE.md `query-state.tsx` convention;
      add `apps/web/src/routes/doctor/refill-requests.test.tsx` covering "Doctor approves a request"
      and "Doctor denies a request".
- [x] 5.3 Add the `/doctor/refill-requests` route and a "Refill requests" nav item to the doctor
      role area in `apps/web/src/router.tsx` (alongside the existing `Appointments`/`Schedule`
      items), and add the route file to `query-state-coverage.test.ts`'s tracked list per the
      CLAUDE.md gotcha; verify `pnpm --filter web run test` passes.

## 6. Documentation and validation

- [x] 6.1 Update `docs/modules/patient.md` and `docs/modules/doctor.md` with the refill-request
      flow; regenerate `docs/architecture/_generated-erd.md`
      (`pnpm --filter api run generate:data-model-diagram`) and update
      `docs/architecture/data-model.md` and `docs/architecture/clinical-access.md` per design.md's
      "Documentation to update"; verify `pnpm docs:build` succeeds.
- [x] 6.2 Run `pnpm --filter api run lint`, `pnpm --filter api run typecheck`,
      `pnpm --filter web run lint`, `pnpm --filter web run typecheck`, `pnpm test`, and
      `pnpm test:e2e`; verify all pass.
- [x] 6.3 Run `pnpm traceability` and verify every scenario in `specs/prescription-refills/spec.md`
      and the new `notifications` scenarios maps to a named test.
- [x] 6.4 Run `pnpm exec openspec validate add-prescription-refills --strict` and verify it passes.
