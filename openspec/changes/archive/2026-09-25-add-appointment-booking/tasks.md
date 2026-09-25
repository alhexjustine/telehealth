# Tasks

## 1. Error codes

- [x] 1.1 Add the domain error type, `error-codes.ts`, and `code` passthrough in the global exception filter and Swagger error schema; unit test "Business-rule error code" and verify existing error tests still pass

## 2. Data model and constraints

- [x] 2.1 Add `Appointment` and `AppointmentSymptom` models and a migration that appends the two exclusion constraints and the range check; regenerate the Prisma client; verify a subsequent `prisma migrate dev --create-only` produces no migration that drops the constraints (record the result), and add an e2e test asserting the constraints exist in `pg_constraint`
- [x] 2.2 e2e test "Database rejects overlap directly" (raw insert of an overlapping BOOKED row fails with 23P01; an overlapping CANCELLED row succeeds)

## 3. Availability changes

- [x] 3.1 Extend `generateSlots` with booked intervals and load BOOKED intervals in the slots endpoint and `NextSlotService`; unit tests "Booked slot removed" and "Booking of a different length"; verify existing availability and discovery tests still pass
- [x] 3.2 Extract the local-range-to-instant helper and implement the booking-containment check on schedule save and the overlap check on time-off create; unit test across a DST change; e2e tests "Schedule change would orphan a booking" and "Time off over a booking"

## 4. Booking API

- [x] 4.1 Implement `BookingRules` and `booking.constants.ts`; unit/e2e coverage for each rule branch
- [x] 4.2 Implement `POST /appointments`; e2e tests "Successful booking", "Incomplete profile", "Not an available slot", "Too far ahead", "Too many upcoming appointments", "Patient already busy", "Hidden doctor", "Non-patient denied" (booking), "Concurrent bookings of the same slot"
- [x] 4.3 Implement reschedule (single transaction, history link, constraint-error mapping); e2e tests "Successful reschedule", "Too close to start", "New slot unavailable", "Not the patient's appointment"
- [x] 4.4 Implement cancel for patients and doctors; e2e tests "Patient cancels", "Doctor cancels with reason", "Doctor cancels without reason", "Already started or not booked", "Not a participant"
- [x] 4.5 Implement list and detail with history; e2e tests "Patient lists upcoming", "Doctor lists past", "Participant views details", "Non-participant denied", "Signed-out denied" (appointments)
- [x] 4.6 Regenerate the OpenAPI document and client (including the error `code` helper) and verify the web package typechecks

## 5. Web

- [x] 5.1 Enable "Book" in the slot picker and build the booking page with symptom carry-over and error handling; Vitest tests "Book from the slot picker", "Slot taken while confirming", "Incomplete profile in the web app"
- [x] 5.2 Build `/patient/appointments` (tabs, reschedule dialog, cancel dialog, rule-based disabling) and `/patient/appointments/:id`; Vitest test "Reschedule disabled near start"
- [x] 5.3 Build `/doctor/appointments` with cancel-with-reason and the doctor home "Today" list; Vitest test "Doctor's today list"
- [x] 5.4 Show schedule/time-off booking conflicts on the doctor schedule page; Vitest test for the conflict list rendering
- [x] 5.5 Verify manually against `pnpm dev` (or via Vitest + curl if no browser tool is available, stated in the report): Find care → doctor → book → reschedule → cancel; doctor sees and cancels a booking; schedule change blocked by a booking

## 6. Documentation

- [x] 6.1 Update Patient and Doctor module pages (booking overviews, L2 flows, data model, booking sequence diagram with the constraint), `c4-component.md`, the error code catalogue, and `docs/index.md`; regenerate the data model page; verify `pnpm docs:build` passes

## 7. Integration check

- [x] 7.1 Run lint, typecheck, unit, e2e, build, docs build, generated-file freshness checks, `openspec validate --all --strict`, and `docker compose down -v && docker compose up --build`; confirm a patient can book and cancel through `http://localhost:8080`
