# Design

## Context

This change builds on two earlier changes:
- `add-authentication` provides doctor and patient profiles, specializations (13 fixed slugs and
  UUIDs inserted by a data migration), guards and decorators, and the web role areas.
- `add-doctor-availability` provides the pure `generateSlots`, `SLOT_LEAD_MINUTES`, the slots
  endpoint, and the visibility rule "approved, or yourself".

If those changes differ in naming from this document once implemented, adapt to the real code
and keep the behavior in the specs. The requirements are in `specs/doctor-discovery` and
`specs/doctor-matching`.

## Goals / Non-Goals

**Goals:**
- A single "visible doctor" query rule (approved + active), shared by search, profile, slots, and
  matching.
- A matching engine that is a pure function over catalog data, easy to test and to explain in the
  demo.
- Reuse the slot generator for "next available" instead of duplicating logic.

**Non-Goals:**
- Booking from the slot picker (`add-appointment-booking`).
- Admin editing of the symptom catalog or rules. The catalog is read-only reference data, like
  specializations.
- Full-text search engines or fuzzy matching; `ILIKE` over name and specialization is enough at
  this scale.
- Persisting matching requests. The web passes the selected symptoms on to booking via the URL,
  and booking decides whether to store them.

## Decisions

### Visible-doctor rule in one place
`DoctorVisibilityService` (or a Prisma `where` helper) defines
`verificationStatus = APPROVED AND user.status = ACTIVE`, plus `OR userId = caller` for
profile and slots. Search, profile, slots (refactor its existing check to use this helper), and
matching all use it.
*Rejected:* a separate inline `where` in each module, which risks drift, and suspended doctors
leaking into one of them.

### Next available slot
A `NextSlotService.nextSlotFor(doctors, now, horizon = 14 days)` loads rules and exceptions for
all candidate doctors in two queries, then runs `generateSlots` per doctor. It returns the first
slot or `null`. The availability filter uses the same data: the doctor matches if any slot falls
in the requested range.

Search then works as follows:
1. Filter in SQL by text, specialization, and visibility.
2. Compute next slots for that filtered set.
3. Apply the availability filter.
4. Sort.
5. Paginate in memory.

This is acceptable for a prototype-scale catalog, which is dozens to low hundreds of doctors, and
is documented as a scaling limit.

`add-appointment-booking` will make `generateSlots` subtract booked intervals, and
`NextSlotService` will pick that up without changes.
*Rejected:* denormalized "next slot" columns refreshed by a job, which add a job, staleness, and
invalidation logic for no benefit at this scale.

### Search API
`GET /doctors?q=&specialization=&availableFrom=&availableTo=&sort=next|name|experience&page=1&pageSize=12`
returns `{ items, total, page, pageSize }`. An unknown specialization slug returns 400, checked
against the catalog. `GET /doctors/{id}` returns the public profile DTO. It never includes email,
license number, or review note.

### Symptom catalog as a data migration
The catalog follows the same pattern as specializations:
- Tables: `symptoms` (id, slug, name, category, keywords `text[]`, is_red_flag) and
  `symptom_specializations` (symptom_id, specialization_id, weight 1–3, PK on both).
- A migration inserts at least 40 symptoms with fixed UUIDs, including every rule and red flag
  named in the spec, using the specialization UUIDs from the auth migration.
- Suggested categories: General, Head & Neurological, Respiratory, Heart & Circulation,
  Digestive, Skin, Mental Health, Musculoskeletal, Ear/Nose/Throat, Hormonal & Metabolic, and
  Women's Health.
- Every one of the 13 specializations must be reachable from at least one symptom. A unit test
  asserts this, and that every weight is 1–3.

### Matching engine
`match({ symptoms, descriptionText, catalog, patientAge, doctors, now })` is a pure function in
`matching/matching-engine.ts`.
- Text normalization: lowercase, replace non-letters with spaces, collapse whitespace.
- A keyword matches when ` ${normalized} ` contains ` ${keyword} `, which handles whole words and
  multi-word phrases. Only keywords from the catalog are used, with no stemming, so behavior stays
  predictable and explainable.
- Scoring follows the spec's algorithm exactly. Each reason is stored as
  `{ symptomId, symptomName, specializationId, specializationName, weight, source }`, and the age
  rule adds a reason of kind `age`.
- The patient's age comes from `PatientProfile.birthDate` evaluated at `now`. If no birthday is
  set, the age rule is skipped, and the response flags `ageUnknown` so the UI can suggest
  completing the profile.
- Output: `{ urgent, redFlags[], matchedSymptoms[], specializations[], doctors[] }`.
- The emergency message text is a constant in the API, so it's consistent and reviewable.
*Rejected:* weighted fuzzy text matching or TF-IDF over descriptions, which is less predictable
and harder to justify as "deterministic rules".

### API surface
| Method | Path | Access |
|---|---|---|
| GET | `/doctors` | any signed-in |
| GET | `/doctors/{doctorId}` | any signed-in (visibility rule) |
| GET | `/symptoms` | any signed-in |
| POST | `/matching` | PATIENT |

Check for a route clash between `GET /doctors/{doctorId}` and the existing `/doctors/me/...`
routes. Register the `me` routes first, or validate `doctorId` as a UUID so that `me` never
matches.

### Web
- `/patient/doctors`: filters are kept in the URL search params (a `useSearchParams`-driven
  query). The availability filter's presets are converted to instants in the browser's time zone.
  The list uses cards and a pagination control. The empty state links to Find care.
- `/patient/doctors/:doctorId`:
  - The profile, plus a slot picker over the next 14 days, grouped by local date. The tab or date
    strip shows day, date, and count.
  - Times are formatted with `date-fns`/`@date-fns/tz` in the browser's time zone, labeled with
    it.
  - The selected slot shows a summary card with a "Book" button. It stays disabled with "Booking
    is coming soon" until `add-appointment-booking` wires it, which keeps the component contract
    stable.
  - When there's no availability, the page links to the search filtered by the doctor's first
    specialization.
- `/patient/find-care`:
  - Symptom chips grouped by category, with a filter box, a textarea with a character counter,
    and submit.
  - Results: the urgent banner (alert, destructive variant) with an acknowledgement checkbox that
    gates the doctor list, the matched symptoms (labeled selected or described), specialization
    chips with a "why" popover, and doctor cards with reasons and next slot, linking to the doctor
    page with `?symptoms=<ids>` preserved for booking.
  - A disclaimer is always visible, and a note to complete the profile when the age is unknown.
- The patient navigation gains "Find care" and "Find a doctor".

### Testing approach
- Unit tests: the matching engine for every spec scenario (with a fixture catalog that mirrors
  the migration's rule rows for the five named symptoms), text normalization edge cases, catalog
  integrity (every specialization reachable, weights within bounds), and the sort comparator.
- e2e tests: search filters, sort, and pagination; visibility (a suspended doctor is excluded);
  the profile 404s; the symptom list omits keywords; matching access and validation; the matching
  scenarios against the real migrated catalog; urgent flags.
- Web tests: the filter reflected in the URL, the empty state, slots in patient time (mocked
  time zone), the urgent banner gating the list, and the disclaimer.

## Risks / Trade-offs

- [In-memory filtering and pagination after computing slots] → Fine at prototype scale. The docs
  note it as a limit, and a denormalized next-slot column is the upgrade path.
- [Keyword matching misses synonyms and typos] → Symptom chips are the primary input and the
  description only adds matches. The UI shows what was matched, so patients can correct it.
- [The emergency warning could be missed] → It's shown first, gates the doctor list, and names
  the symptoms. Wording is kept in one constant for review.
- [Clinical accuracy of the rule weights] → The data is fictional prototype data. The disclaimer
  and the docs say so, and the rules are reviewable in one migration file.

## Migration Plan

Additive: two tables populated by one data migration.

## Documentation impact

- `docs/modules/patient.md`: discovery and matching overview, an L2 view of the search, profile
  and matching flows, the symptom tables in the ER diagram, and a "Matching algorithm" section
  with the steps and a worked example (Headache + Cough).
- `docs/architecture/c4-component.md`: Discovery and Matching components move to done.
- Regenerate the data model page and the OpenAPI client. Mark the discovery and matching
  features as done in `docs/index.md`.
