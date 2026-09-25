# Tasks

## 1. Data model

- [x] 1.1 Add `timezone` to `DoctorProfile` (default `UTC`), `AvailabilityRule`, and `AvailabilityException` models with a migration; regenerate the Prisma client and verify `pnpm db:migrate` applies cleanly on a fresh dev DB and on one migrated to the previous change

## 2. Slot generator

- [x] 2.1 Add `date-fns` and `@date-fns/tz` to `apps/api`; implement the pure `generateSlots` function and `SLOT_LEAD_MINUTES`; unit tests "Slots follow the schedule and consultation length", "Consultation length does not divide the range", "Time off removes overlapping slots", "Too-soon slots removed", "Clocks spring forward", "Clocks fall back", plus multi-range days, exception touching a slot edge, and a range spanning several weeks
- [x] 2.2 Implement the schedule domain validator (overlap, order, 15-minute steps, minimum length, time zone); unit tests for each error with field-indexed results

## 3. Availability API

- [x] 3.1 Implement `GET/PUT /doctors/me/availability` (replace-all in one transaction); e2e tests "Save a valid schedule", "Overlapping ranges", "End not after start", "Range shorter than consultation", "Invalid time zone", "Non-doctor denied", "Signed-out denied" (availability), "Doctor views availability", "New doctor"
- [x] 3.2 Implement time-off create/delete; e2e tests "Add time off", "Invalid time off", "Delete own time off", "Another doctor's time off"
- [x] 3.3 Implement `GET /doctors/{doctorId}/slots` with range validation and visibility rules; e2e tests "Patient views an approved doctor's slots" (approve the doctor via direct DB update in the test), "Unapproved doctor hidden", "Doctor previews own slots while pending", "Signed-out denied" (slots), "Invalid range", "Schedule changes apply immediately"
- [x] 3.4 Regenerate the OpenAPI document and client and verify the web package typechecks

## 4. Web schedule page

- [x] 4.1 Add `date-fns` and `@date-fns/tz` to `apps/web`; build `/doctor/schedule` with the time-zone selector (browser default before first save), the weekly editor with zod validation, and the "copy Monday to weekdays" shortcut; Vitest test "Inline range errors"
- [x] 4.2 Add the time-off list and form (inputs interpreted in the doctor's time zone) and the 7-day slot preview; Vitest tests for time-off conversion to UTC and "Preview updates after saving"
- [x] 4.3 Add the Schedule nav entry and a warning for ranges shorter than the consultation length; verify manually against `pnpm dev` (or via Vitest + curl if no browser tool is available, stated in the report): set a schedule, add time off, see the preview change

## 5. Documentation

- [x] 5.1 Update `docs/modules/doctor.md` (availability overview, L2 view, data model, slot algorithm with DST rules), `c4-component.md`, and `docs/index.md`; regenerate the data model page; verify `pnpm docs:build` passes and diagrams render

## 6. Integration check

- [x] 6.1 Run lint, typecheck, unit, e2e, build, docs build, generated-file freshness checks, `openspec validate --all --strict`, and `docker compose down -v && docker compose up --build`; confirm a doctor can save a schedule and read their slots through `http://localhost:8080`
