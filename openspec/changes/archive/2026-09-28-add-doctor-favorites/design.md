# Design

## Context

See `proposal.md` for motivation. Relevant existing shape:
- `Dependent` (`apps/api/prisma/schema.prisma`) is the precedent for a small, patient-owned
  first-party table with a per-patient cap (`MAX_DEPENDENTS_PER_PATIENT = 10`,
  `DEPENDENT_LIMIT_REACHED`) and its own module (`apps/api/src/dependents`).
- `DiscoveryController`/`DiscoveryService` (`apps/api/src/discovery`) already builds a doctor
  search-card summary (name, specializations, years of experience, `acceptingBookings`, next
  available slot within 14 days) and a public profile view, gated to approved+active doctors only.
- `AppointmentResponseDto` (`apps/api/src/appointments/dto/appointment-response.dto.ts`) already
  returns `doctor.id` and `dependent.id` (nullable) on every appointment list item — everything
  "Book again" needs is already in that payload.
- `book-appointment.tsx` already has full attendee-selection state (`dependentId`, defaulting to
  `''` for the account holder) built for `add-dependent-booking`'s inline dependent creation; it
  just doesn't yet accept a starting value from the URL.
- `add-doctor-reviews` (proposed in the same batch) is a separate in-flight change also touching
  doctor discovery, but at the review/rating level.

## Goals / Non-Goals

**Goals:**
- Favoriting/unfavoriting and listing favorites, backed by a new patient-owned table.
- A favorites list whose entries carry live, current doctor data (not a stale snapshot).
- "Book again" as a pure navigation/prefill feature with zero new appointment-mutating behavior.

**Non-Goals:**
- Any change to doctor search ranking, filtering, or the specialty-matching algorithm.
- Any doctor-facing or admin-facing visibility into who favorited them (no notification, no
  admin oversight surface — there is no user-generated content here to moderate, unlike reviews).
- A dedicated "book again" backend endpoint — this is done entirely with data the appointments
  list already returns, plus an optional query param on existing patient-facing pages.

## Decisions

**Favorite state is not embedded in doctor-discovery's search/profile response DTOs.**
Alternative considered: add an `isFavorited: boolean` field to `DoctorSearchResultDto` and
`PublicDoctorProfileDto`, computed per-request from the current user. Rejected because (a) it
would require every discovery-service query to join against the new favorites table even for
non-patient callers (doctors/admins can also call these endpoints) and to return a
role-conditional field; and (b) it would touch the `doctor-discovery` capability's spec, which
`add-doctor-reviews` is separately proposing to modify at the same time — keeping favorites in its
own capability and its own response shapes avoids two in-flight changes editing the same spec
file/response DTO. Instead, the web app fetches the patient's full favorites list once (a `GET
/patients/me/favorites` call, cached the same way `useDependents` already caches its list) and
checks doctor-ID membership client-side to render each card's/profile's toggle state. This is the
same "fetch small list once, look up client-side" pattern already used for dependents.

**Unfavoriting (and re-favoriting) is idempotent, not a strict "must already exist" delete.**
Alternative considered: `DELETE /patients/me/favorites/:doctorId` 404s if the doctor isn't
currently favorited, matching how `DELETE /patients/me/dependents/:id` 404s for someone else's (or
a nonexistent) dependent ID. Rejected: a dependent ID is a resource the patient must already know
exists (they got it from a prior list/create call); a doctor ID a patient is toggling a star for is
not — a double-click, a stale cached toggle-button state, or two tabs racing each other would then
surface a needless error for a purely cosmetic action. A favorite/unfavorite toggle is simplest and
most robust as an idempotent "ensure state" operation in both directions.

**Favorites-list entries are computed live from `DiscoveryService`, not stored as a snapshot.**
The favorites table stores only `(patientId, doctorId, createdAt)`. Listing composes with
`DiscoveryService`'s existing per-doctor summary builder (extracted into a small shared method
rather than duplicated) so a favorite's displayed `acceptingBookings`/next-slot/specializations are
always current, and a doctor who has since become hidden is filtered out post-query rather than
needing its own "is this doctor still visible" check duplicated in the new module.

**"Book again" is a URL/prefill convention, not a new endpoint.** The web already has
`GET /patient/doctors/:doctorId` (profile) and `GET /patient/doctors/:doctorId/book` (confirmation,
reads `?start=` and `?symptoms=` already). This change adds one more optional query param,
`?dependent=<id>`, read by both pages: the profile page carries it through into the "Book" link it
already builds per slot, and the booking confirmation page uses it to initialize `dependentId`
state (falling back to the account holder if the ID doesn't match any of the patient's current
dependents — e.g. the dependent was later removed). No new DTO, no new backend route.

## Risks / Trade-offs

- [A patient's favorites list does one N-doctor lookup per view, each re-deriving a discovery-card
  summary] → acceptable at prototype scale (the existing 50-favorite cap bounds the worst case);
  matches how the existing doctor search itself already computes summaries per request.
- [Silently dropping a no-longer-visible doctor from the favorites list could look like the
  favorite was "lost" without explanation] → this exactly mirrors the existing, already-shipped
  doctor-discovery behavior for search results, so it's a consistent, already-understood pattern
  rather than a new one.
- [`?dependent=` is user-suppliable and could reference a dependent that isn't the current
  patient's] → the booking confirmation page must validate the ID against the patient's *own*
  current dependents list (already fetched there) before treating it as selected, falling back to
  "Myself" otherwise; the actual booking call still re-validates the dependent belongs to the
  patient server-side (unchanged from `add-dependent-booking`), so this is a UX-prefill concern
  only, not an authorization one.

## Documentation

- `docs/modules/patient.md`: add favorites (favorite/unfavorite, My favorites page) and "Book
  again" to the Patient module's feature list and data model.
- API reference: regenerated automatically from the OpenAPI doc via `pnpm openapi:generate`.
