# Tasks

## 1. Schema and error code

- [x] 1.1 Add `acceptingBookings Boolean @default(true) @map("accepting_bookings")` to `DoctorProfile` in `apps/api/prisma/schema.prisma`; run `pnpm --filter api run prisma:migrate:dev --name add_doctor_accepting_bookings` against a running dev Postgres and verify the generated migration only adds this column with the default, then `pnpm --filter api run prisma:generate`
- [x] 1.2 Add `DOCTOR_NOT_ACCEPTING_BOOKINGS` to `apps/api/src/common/errors/error-codes.ts`, following the existing doc-comment style of its neighbors (`SLOT_UNAVAILABLE`, `BEYOND_BOOKING_HORIZON`)

## 2. Booking enforcement

- [x] 2.1 In `apps/api/src/appointments/booking-rules.ts`'s `assertBookable()`, add a new step 3 (after "doctor visible", before "within the booking horizon", renumbering the rest) that throws `DomainError(HttpStatus.CONFLICT, ErrorCode.DOCTOR_NOT_ACCEPTING_BOOKINGS, ...)` when `!doctorProfile.acceptingBookings`, reusing the already-loaded `doctorProfile` row
- [x] 2.2 Add "Doctor not accepting bookings" to `apps/api/test/appointments-book.e2e-spec.ts` (approve a doctor, turn off accepting bookings via `PATCH /doctors/me/profile`, attempt to book an otherwise-available slot, expect `409 DOCTOR_NOT_ACCEPTING_BOOKINGS`) and "Doctor stopped accepting bookings" to `apps/api/test/appointments-reschedule.e2e-spec.ts` (book, then turn off accepting bookings, then attempt to reschedule, expect the same code and the original still `BOOKED`); verify with `pnpm --filter api run test:e2e -t "Doctor not accepting bookings"` and `-t "Doctor stopped accepting bookings"`

## 3. Slot visibility

- [x] 3.1 In `apps/api/src/availability/availability.service.ts`'s `getSlots()`, after the existing visibility check, return `[]` when `caller.id !== doctorId && !profile.acceptingBookings`
- [x] 3.2 Add "Slots hidden while not accepting bookings" and "Doctor still previews own slots while not accepting bookings" to `apps/api/test/availability-slots.e2e-spec.ts`; verify with `pnpm --filter api run test:e2e -t "accepting bookings"`

## 4. Discovery and matching

- [x] 4.1 In `apps/api/src/discovery/discovery.service.ts`'s `search()`, where `candidates` is built, use `profile.acceptingBookings ? (slotsByDoctor.get(profile.userId) ?? []) : []` instead of the current unconditional lookup; add `acceptingBookings: boolean` to `DoctorSearchResultDto` and set it from the profile in `toSearchResultDto()`
- [x] 4.2 Add `acceptingBookings: boolean` to `PublicDoctorProfileDto` and set it in `getProfile()`
- [x] 4.3 In `apps/api/src/matching/matching.service.ts`'s `loadDoctors()`, force the doctor's `nextAvailableSlot` to `null` when `!profile.acceptingBookings` (same one-line pattern as 4.1); no DTO or ranking-algorithm change needed, since the existing "no slot sorts last" rule already covers it
- [x] 4.4 Add "Not accepting bookings still listed" and "Not accepting bookings excluded from an availability filter" to `apps/api/test/discovery-search.e2e-spec.ts`, and "Not accepting bookings shown on profile" to `apps/api/test/discovery-profile.e2e-spec.ts`; verify with `pnpm --filter api run test:e2e -t "accepting bookings"`

## 5. Doctor's own profile

- [x] 5.1 Add `acceptingBookings?: boolean` (`@IsOptional() @IsBoolean()`) to `UpdateDoctorProfileDto` and `acceptingBookings: boolean` to `DoctorProfileResponseDto`; in `DoctorsService.updateOwnProfile()`, apply it like the other optional fields (`if (dto.acceptingBookings !== undefined) data.acceptingBookings = dto.acceptingBookings;`), outside the re-review check, and include it in `toDto()`
- [x] 5.2 Add "Turn off accepting bookings", "Turn on accepting bookings", and "Existing appointments unaffected" (book one first, toggle off, then `GET` the appointment and confirm it's still `BOOKED`) to `apps/api/test/doctors-profile.e2e-spec.ts`; verify with `pnpm --filter api run test:e2e -t "accepting bookings"`

## 6. Doctor home page toggle

- [x] 6.1 Add `apps/web/src/components/accepting-bookings-toggle.tsx`: a labeled `radix-ui` `Switch` reading `useDoctorProfile().data?.acceptingBookings` and writing through `useUpdateDoctorProfile()`, with "In" / "Out" text reflecting the current state and a pending/disabled state while saving
- [x] 6.2 Add the toggle to `routes/doctor/home.tsx` near the welcome header
- [x] 6.3 Add `apps/web/src/components/accepting-bookings-toggle.test.tsx` covering "Switch off from the home page" (mock the hooks, click the switch, assert the mutation is called with `{ acceptingBookings: false }` and the label updates); verify with `pnpm --filter web exec vitest run src/components/accepting-bookings-toggle.test.tsx`

## 7. Patient-facing copy

- [x] 7.1 In `routes/patient/doctors.tsx`, when a result's `acceptingBookings` is `false`, show a muted "Not accepting bookings" chip in place of the tinted next-available panel; verify `src/routes/patient/doctors.test.tsx` still passes and add a case for the not-accepting chip
- [x] 7.2 In `routes/patient/doctor-profile.tsx`, branch the "Available times" empty-state copy on `profileData.acceptingBookings` (`false`: "This doctor isn't accepting new bookings right now." in place of "No times are available in the next 14 days."); add a covering case to `src/routes/patient/doctor-profile.test.tsx`

## 8. Client, docs, and full verification

- [x] 8.1 Run `pnpm openapi:generate` and verify `packages/api-client`'s generated types include `acceptingBookings` on the search result, public profile, and own-profile schemas
- [x] 8.2 Update `docs/modules/doctor.md` (home page toggle) and `docs/modules/patient.md` (search/profile "not accepting bookings" state)
- [x] 8.3 Run `pnpm --filter api run lint`, `pnpm --filter api run typecheck`, `pnpm --filter web run lint`, `pnpm --filter web run typecheck`; all pass
- [x] 8.4 Run `pnpm --filter api run test:e2e` (full suite, unfiltered) and `pnpm --filter web run test` (full suite); all pass
- [x] 8.5 Rebuild the stack (`docker compose up --build -d`) and, in a browser, sign in as the demo doctor, toggle "Out" on the home page, then sign in as the demo patient and confirm that doctor shows "Not accepting bookings" on Find a doctor and their profile page, with no bookable slots
- [x] 8.6 Run `pnpm traceability` and `pnpm exec openspec validate --strict add-doctor-accepting-bookings`; both pass
