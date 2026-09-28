# Proposal

## Why

Patients who see the same doctor repeatedly (a standing GP, a specialist managing a chronic
condition) have no shortcut back to them today — every booking, even a routine follow-up, starts
over at Find a doctor's search/filter/guided-matching flow. Letting a patient bookmark a doctor
and jump straight from "My favorites" or a past appointment into that doctor's slot picker turns a
repeat booking into a two-click action instead of a re-search, at very low implementation cost
(reuses the existing doctor-profile and booking-confirmation pages as-is).

## What Changes

- A signed-in patient can favorite/unfavorite an approved, active doctor from the doctor's
  discovery card or profile page (a toggleable star).
- A new "My favorites" page in the patient area lists favorited doctors with the same summary
  shown on a search result card (name, specializations, experience, accepting-bookings state, next
  available slot), plus a "Book" shortcut straight into that doctor's profile — skipping Find a
  doctor's search/filter/guided-matching step entirely.
- A doctor who is later suspended, rejected, or deactivated is silently dropped from the favorites
  list (mirrors doctor-discovery's existing "only approved, active doctors" visibility rule) rather
  than shown as broken or erroring.
- Favoriting/unfavoriting is a pure organizational convenience: it has **no effect** on doctor
  search ranking, sorting, or the deterministic specialty-matching algorithm.
- A patient can have at most 50 favorited doctors at once (mirrors the existing per-patient cap
  pattern used for dependents); re-favoriting an already-favorited doctor, or unfavoriting one
  that isn't favorited, is a no-op rather than an error.
- The patient's appointments page (upcoming and past) gains a "Book again" shortcut per
  appointment that deep-links straight into that same doctor's profile, pre-selecting the same
  attendee (the account holder or the specific dependent) the original appointment was for —
  skipping search the same way the favorites list does. This reuses data the appointments list
  already returns (`doctor.id`, `dependent.id`); no new appointments endpoint is introduced.

No external SaaS/BaaS/runtime API is introduced — favorites are a plain first-party Postgres table
behind a new NestJS module, following the same patient-owned-resource shape as
`add-dependent-booking`'s `Dependent` model.

**Modules affected:** Patient (favorites list, favorite toggle, "Book again"). Doctor and Admin are
unaffected — a doctor cannot see who favorited them, and no admin oversight surface is added for
favorites (there is no clinical or moderation content to review, unlike `add-doctor-reviews`).

## Capabilities

### New Capabilities
- `doctor-favorites`: lets a signed-in patient favorite/unfavorite an approved, active doctor and
  list their current favorites (each enriched with the doctor's live discovery-card summary), with
  a per-patient cap and silent exclusion of doctors that are no longer visible.

### Modified Capabilities
- `appointments`: adds a "Book again" requirement to the existing "Managing appointments in the
  web app" area — a per-appointment shortcut into the same doctor's profile, pre-selecting the same
  attendee, without introducing any new endpoint.

## Impact

- **API**: new `apps/api/src/favorites` module — `PATIENT`-only routes under
  `/patients/me/favorites` (`POST` to favorite, `DELETE /:doctorId` to unfavorite, `GET` to list).
  New `DoctorFavorite` Prisma model/migration (`patientId` + `doctorId`, unique together),
  following `Dependent`'s per-patient-owned-resource pattern. New `ErrorCode.FAVORITE_LIMIT_REACHED`.
  The favorites-list endpoint composes with `DiscoveryService`'s existing doctor-summary logic to
  build each entry — it does not change any `doctor-discovery` response shape or add fields there,
  so it does not touch that capability's spec.
- **Web**: new `apps/web/src/routes/patient/favorites.tsx` page + nav entry; a favorite-toggle
  control added to `doctors.tsx` (search results) and `doctor-profile.tsx`; a "Book again" link
  added to `appointments.tsx`'s per-appointment row, and `book-appointment.tsx`/`doctor-profile.tsx`
  read an optional `?dependent=` query param to preselect the attendee it already supports choosing
  manually (added by `add-dependent-booking`).
- **api-client**: regenerate `packages/api-client` from the updated OpenAPI doc.
- **Docs**: update the Patient module's technical documentation page (feature list, data model) and
  the API reference.
- **Overlap with other in-flight changes**: `add-doctor-reviews` (proposed in this same batch) also
  touches doctor discovery, but at the *review/rating* level, not favorites — the two are designed
  to compose independently (see this change's design.md) and neither's spec deltas touch the same
  file, so no merge-order dependency is expected. Flagging per this project's convention for
  overlapping in-flight changes (as `add-dependent-booking` did for `add-consultation-video` on
  `consultation-session`).
