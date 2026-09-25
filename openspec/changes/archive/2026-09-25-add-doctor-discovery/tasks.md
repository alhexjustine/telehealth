# Tasks

## 1. Shared doctor visibility and next slot

- [x] 1.1 Extract the visible-doctor rule (approved + active, optionally self) into one helper and use it from the existing slots endpoint; verify the existing availability e2e tests still pass and add an e2e test that a suspended approved doctor's slots return 404
- [x] 1.2 Implement `NextSlotService` (batched rule/exception loading, `generateSlots` per doctor, 14-day horizon); unit tests for first-slot selection and doctors with no availability

## 2. Doctor search and profile (API)

- [x] 2.1 Implement `GET /doctors` with query, specialization, availability filter, sort, and pagination; e2e tests "Only approved, active doctors listed", "Text query", "Specialization filter", "Availability filter", "Invalid filters", "Signed-out denied" (search), "Default sort", "Pagination"
- [x] 2.2 Implement `GET /doctors/{doctorId}` (UUID-validated, no clash with `/doctors/me/*`); e2e tests "View approved doctor" (assert no email, license, or review note) and "Hidden doctor"

## 3. Symptom catalog and matching (API)

- [x] 3.1 Add the `symptoms` and `symptom_specializations` models and the data migration with at least 40 symptoms across at least 8 categories, including every spec-named rule and red flag; unit test for catalog integrity (every specialization reachable, weights 1–3); e2e test "Catalog available after migration"
- [x] 3.2 Implement `GET /symptoms`; e2e tests "Patient lists symptoms" and "Signed-out denied" (symptoms)
- [x] 3.3 Implement the pure matching engine; unit tests "Selected symptom", "Symptom found in the description", "Weights add up", "Under-18 patient", "No match", "Deterministic result", "Red flag selected", "Red flag described", plus normalization edge cases (punctuation, multi-word keywords, partial-word non-match)
- [x] 3.4 Implement `POST /matching`; e2e tests "Neither symptoms nor description", "Unknown symptom", "Non-patient denied", and the scenarios from 3.3 run against the real migrated catalog
- [x] 3.5 Regenerate the OpenAPI document and client and verify the web package typechecks

## 4. Web

- [x] 4.1 Build `/patient/doctors` with URL-synced filters, sort, pagination, cards, and the empty state; Vitest tests "Filter from the page" and "No results"
- [x] 4.2 Build `/patient/doctors/:doctorId` with profile, 14-day slot picker in the patient's time zone, selected-slot summary with the disabled "Book" button, and the no-availability suggestion; Vitest tests "Slots shown in patient time" and "No availability"
- [x] 4.3 Build `/patient/find-care` with categorized symptom chips, the description field, results with reasons, the urgent banner that gates the doctor list, the disclaimer, and the incomplete-profile note; Vitest tests "Urgent result in the page" and "Disclaimer always shown"
- [x] 4.4 Add the patient navigation entries; verify manually against `pnpm dev` (or via Vitest + curl if no browser tool is available, stated in the report): search → open doctor → see slots; Find care with Chest pain → banner → acknowledge → doctors

## 5. Documentation

- [x] 5.1 Update `docs/modules/patient.md` (overview, L2 view, data model, matching algorithm with the Headache + Cough worked example), `c4-component.md`, and `docs/index.md`; regenerate the data model page; verify `pnpm docs:build` passes

## 6. Integration check

- [x] 6.1 Run lint, typecheck, unit, e2e, build, docs build, generated-file freshness checks, `openspec validate --all --strict`, and `docker compose down -v && docker compose up --build`; confirm matching returns results through `http://localhost:8080` for a patient (approving a doctor via direct DB update, since the admin console doesn't exist yet)
