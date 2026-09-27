# Design

## Context

See proposal.md - Why. The relevant existing pieces (all in `apps/api/src`):
- `doctors/doctor-visibility.ts`'s `visibleDoctorWhere()`/`isVisibleDoctor()` is the one rule for
  whether a doctor is visible at all (approved + active account, or viewing your own profile). It
  is shared by search, the public profile, slots, and matching.
- `appointments/booking-rules.ts`'s `BookingRules.assertBookable()` is the one rule for whether a
  booking (or reschedule) may proceed, run inside the same transaction as the write. It already
  loads the full `doctorProfile` row while checking visibility.
- `availability/availability.service.ts`'s `getSlots()` and `availability/next-slot.service.ts`'s
  `slotsFor()`/`nextSlotFor()` compute slots; neither filters by visibility itself — callers do.
- `discovery/discovery.service.ts`'s `search()` already threads an optional `availabilityRange`
  into slot filtering and into `toSearchResultDto()` (from the redesign work's next-available-slot
  fix); this change extends the same data flow.
- `doctors/doctors.service.ts`'s `updateOwnProfile()` already applies only the DTO fields the
  caller sent, and separately triggers re-review only when license/specializations change.

## Goals / Non-Goals

**Goals:**
- A doctor can pause and resume new bookings themselves, enforced in NestJS.
- Existing appointments, verification status, and account status are completely unaffected.
- Reuse the existing profile-update endpoint and the existing visibility/slot-computation
  machinery; add one boolean and thread it through, rather than a parallel status system.

**Non-Goals:**
- Any change to `admin-appointments/invalid-booking.ts`'s `DOCTOR_UNAVAILABLE` flag. That flag
  means "not approved or not active" — a still-approved, still-active doctor who paused bookings is
  a different, deliberate state, not an admin-actionable problem. A doctor's own upcoming
  appointments stay exactly as they are when they pause.
- Any change to guided matching's ranking algorithm or its Find care page copy. Forcing
  `nextAvailableSlot` to `null` for a paused doctor is enough: the existing "ties broken by name,
  no-slot doctors last" sort and the existing no-availability copy already handle it correctly.
- A scheduled/automatic "away" mode (e.g. pausing during declared time off). The doctor flips this
  by hand; time off is unrelated Schedule-page functionality.
- Surfacing the toggle in the admin console. Not asked for, and admins already have suspend/
  deactivate for account-level concerns.

## Decisions

- **One boolean, on `DoctorProfile`, via the existing profile-update endpoint.** `acceptingBookings
  Boolean @default(true)`. The web toggle calls `useUpdateDoctorProfile()` (already used by the
  Profile page) with just `{ acceptingBookings }` — no new endpoint, no new mutation hook.
  - *Alternative considered*: a dedicated `POST /doctors/me/accepting-bookings` endpoint. Rejected:
    `updateOwnProfile()` already applies only the fields present in the DTO and already skips
    re-review unless license/specializations change, so a single boolean field needs no new
    plumbing there — a second endpoint would just be a second way to write the same column.
- **Enforced in `BookingRules.assertBookable()`, as a new step 3** (after "doctor visible", before
  "within the booking horizon"): reuses the `doctorProfile` row that step 2 already loaded — no
  extra query — and runs inside the same transaction as the booking write, so a doctor toggling
  off mid-request can't race a booking that started just before. New code
  `DOCTOR_NOT_ACCEPTING_BOOKINGS`, `409`, matching the existing family of booking-rule codes
  (`SLOT_UNAVAILABLE`, `BEYOND_BOOKING_HORIZON`, …). Reschedule already re-runs the same
  `assertBookable()`, so it needs no separate check — only a test confirming it.
- **Slots suppressed for patients, not the doctor, in `getSlots()` only.** After the existing
  visibility check, when `caller.id !== doctorId && !profile.acceptingBookings`, return `[]`
  without computing. `slotsFor()`/`nextSlotFor()` stay generic (no visibility or
  accepting-bookings awareness) — each caller (discovery, matching) already decides what to do
  with the result, which is where this change hooks in instead.
  - *Alternative considered*: teach `isVisibleDoctor()`/`visibleDoctorWhere()` about
    `acceptingBookings`. Rejected: that rule is reused for the profile page and search *listing*
    themselves, which must still show a paused doctor (proposal.md - What Changes) — folding this
    in would 404 a doctor a patient can currently see, which is the wrong behavior.
- **Discovery and matching force `nextAvailableSlot` to `null` for a paused doctor**, at the same
  point `discovery.service.ts` already narrows slots to an availability range (this session's
  earlier fix): `slots: profile.acceptingBookings ? (slotsByDoctor.get(...) ?? []) : []`. This one
  change gets three effects for free: `toSearchResultDto()`'s next-available-slot becomes `null`;
  an availability-range filter's `candidates.filter((c) => c.slots.some(...))` naturally excludes
  them (empty array matches nothing); and default sort's existing "no slot sorts last" rule applies.
  `matching.service.ts`'s `loadDoctors()` gets the equivalent one-line change to its own
  `nextSlots.get(...)` lookup.
- **Search and profile DTOs gain `acceptingBookings: boolean`** so the web can show "Not accepting
  bookings" instead of silently rendering "No upcoming availability" as if it were a scheduling
  gap. `Find care` doctor cards are not changed (Non-Goals).
- **Web**: a small `AcceptingBookingsToggle` component (Switch + label, from `radix-ui`) on
  `routes/doctor/home.tsx`, reading/writing through the existing `useDoctorProfile()` /
  `useUpdateDoctorProfile()`. On `routes/patient/doctors.tsx`, a result card with
  `acceptingBookings: false` shows a muted chip instead of the tinted next-available panel. On
  `routes/patient/doctor-profile.tsx`, the existing "Available times" empty-state copy branches on
  `acceptingBookings` (a plain "Not accepting new bookings right now" instead of "No times are
  available in the next 14 days", which would otherwise misleadingly suggest a temporary
  scheduling gap).

## Risks / Trade-offs

- [A doctor toggles off between a patient loading the profile page and clicking Book] → Already
  covered: `assertBookable()` is the single source of truth and re-checks at write time regardless
  of what the UI showed a moment earlier, the same way `SLOT_UNAVAILABLE` already handles a slot
  taken in the meantime.
- [Existing e2e fixtures/tests that book, then act on a doctor, could be affected if they happen to
  toggle `acceptingBookings`] → They don't; the field defaults to `true` and nothing existing sets
  it, so all current tests are unaffected. Confirmed by grepping the test suite for the new DTO
  field before writing tasks.

## Migration Plan

`prisma migrate dev` generates the column addition (`accepting_bookings BOOLEAN NOT NULL DEFAULT
true`) from the schema change — a straightforward default-backfilled add, no hand-written SQL
needed. Every existing doctor becomes `true` (accepting), matching current real-world behavior
exactly. Rollback is reverting the migration and the code together; no data is destructively
transformed.

## Documentation

- `docs/modules/doctor.md`: the doctor home page description gains the toggle.
- `docs/modules/patient.md`: Find a doctor's result fields and the doctor profile page gain the
  "not accepting bookings" state.
