# Proposal

## Why

A patient needs to find the right doctor before booking. There are two paths: browsing and
searching when they already know what kind of doctor they want, or guided matching when they only
know their symptoms. The brief requires search over application-stored profiles, specializations,
and availability, and symptom matching built from deterministic rules in NestJS, with no external
AI service.

## What Changes

- Doctor search for signed-in users. It covers approved doctors only, with a text query (name or
  specialization), a specialization filter, an "available between" filter, sorting, and
  pagination. Each result shows the doctor's next available slot.
- Public doctor profile pages (for signed-in users) with biography, specializations, experience,
  consultation length, and upcoming slots.
- A symptom catalog, shipped as reference data. Each symptom has patient-friendly names, keywords,
  a category, weighted links to specializations, and an emergency ("red flag") marker.
- Guided matching for patients. The patient selects symptoms and/or describes them in free text.
  The API:
  - finds symptoms in the text by keyword
  - scores specializations by rule weights, with an age rule that routes under-18 patients to
    Pediatrics
  - falls back to General Practice when nothing matches
  - returns the top specializations and ranked approved doctors, with a plain explanation of why
    each matched
  Red-flag symptoms return an emergency warning.
- Web:
  - "Find a doctor" (search and filter list)
  - doctor profile with a slot picker in the patient's local time
  - "Find care" guided matching, with the emergency banner and a "this is not a diagnosis"
    disclaimer
  - Booking from the slot picker arrives in `add-appointment-booking`
- Documentation: Patient module page (discovery and matching), the matching algorithm, L3
  components, and the regenerated data model.

No external SaaS, BaaS, provider directory, or AI service is introduced. No new runtime
dependencies are expected.

**Product modules affected:** Patient (discovery, matching). Doctor is indirectly affected: an
approved doctor's profile becomes visible to patients.

## Capabilities

### New Capabilities
- `doctor-discovery`: Searching, filtering, sorting, and paging approved doctors; viewing a
  doctor's profile and upcoming slots; and the related patient web pages.
- `doctor-matching`: The symptom catalog and its rules, the deterministic matching algorithm, the
  emergency warning, and the guided "Find care" web flow.

### Modified Capabilities
<!-- None. doctor-availability's slot calculation and visibility rules are reused unchanged. -->

## Impact

- API: new `discovery` and `matching` modules. `GET /api/doctors`, `GET /api/doctors/{id}`,
  `GET /api/symptoms`, `POST /api/matching`.
- Database: new `symptoms` and `symptom_specializations` tables, populated by a data migration.
- Web: new `/patient/doctors`, `/patient/doctors/:doctorId`, and `/patient/find-care` routes, and
  patient navigation entries.
- The generated API client and the docs are regenerated.
