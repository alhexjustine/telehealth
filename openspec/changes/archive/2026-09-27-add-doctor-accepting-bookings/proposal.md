# Proposal

## Why

A doctor currently has no way to temporarily stop taking new bookings — on leave, fully booked
elsewhere, or just stepping away — without editing their weekly schedule rules (which affects every
week going forward) or asking an administrator to suspend them (which also signs them out and
cancels their upcoming appointments). A simple in/out toggle on the doctor home page lets a doctor
pause new bookings for as long as they like, with one click to resume, while everything already
scheduled continues normally.

## What Changes

- **New doctor setting**: `acceptingBookings` (boolean, defaults to `true`) on the doctor's own
  profile, independent of verification status and account status.
- **Doctor home page**: an "In" / "Out" toggle near the welcome header. Switching it calls the
  existing profile-update endpoint with just that one field — no new endpoint.
- **Booking enforcement (NestJS, not just the UI)**: `BookingRules.assertBookable` — shared by
  booking and rescheduling — rejects with a new `409 DOCTOR_NOT_ACCEPTING_BOOKINGS` when the
  doctor has paused bookings. This is checked in the same transaction as the rest of the booking
  rules, so it can't be bypassed by calling the API directly.
- **Slots hidden from patients while paused**: the slots endpoint returns none to anyone other
  than the doctor themselves, so a patient can't pick a time that would then fail at booking. The
  doctor still sees their own full schedule when previewing it (Schedule page, "Next 7 days").
- **Search, profile, and guided matching reflect it**: a paused doctor still appears in search and
  can still be viewed (this is not a visibility/account-status change), but shows no next-available
  time and, on search results and their profile page, a plain "Not accepting bookings" notice
  instead of a bookable slot. An availability-range search filter excludes them, since they have no
  bookable time in any range. Guided matching (Find care) already sorts doctors with no next slot
  last and shows the same no-availability copy other doctors get in that state — no change needed
  there.
- **Not affected**: existing appointments (a patient who already booked can still join; a doctor's
  own upcoming appointments are untouched), verification status, account status, and the admin
  "invalid booking" detection (`DOCTOR_UNAVAILABLE`) — that flag is about a doctor no longer being
  approved/active, a different concern from a still-approved doctor choosing to pause new bookings.
- No external SaaS/BaaS/runtime API is introduced. The toggle UI reuses `radix-ui`'s bundled
  `Switch` primitive (already a dependency; no package added).

## Capabilities

### Modified Capabilities

- `doctor-profile`: adds the toggle itself (new requirements — the setting's own mechanics, and its
  home-page control).
- `appointments`: "Book an appointment" and "Reschedule an appointment" gain the new condition and
  error code.
- `doctor-availability`: "Slot visibility" extends to hide slots from patients (not the doctor
  themselves) while paused.
- `doctor-discovery`: "Doctor search" and "Doctor profile view" gain the field and its display
  rules.

## Impact

- **Affected modules:** Doctor (home page toggle, own profile) and Patient (search results, doctor
  profile page, booking/rescheduling — all server-enforced).
- **Code:**
  - `apps/api/prisma/schema.prisma` (+migration), `apps/api/src/common/errors/error-codes.ts`
  - `apps/api/src/appointments/booking-rules.ts` (new check)
  - `apps/api/src/availability/availability.service.ts` (`getSlots`, patient-facing suppression)
  - `apps/api/src/discovery/discovery.service.ts` (search result field + range-filter interaction)
  - `apps/api/src/matching/matching.service.ts` (next-slot suppression, reusing existing sort)
  - `apps/api/src/doctors/{doctors.service.ts,dto/*}` (own-profile read/update)
  - `apps/web/src/routes/doctor/home.tsx` (+ new toggle component), `apps/web/src/routes/patient/{doctors.tsx,doctor-profile.tsx}`
  - `packages/api-client` regenerated after the API changes
- **Tests:** new e2e cases across `appointments-book`, `appointments-reschedule`,
  `availability-slots`, `discovery-search`, `discovery-profile`, `doctors-profile`; web unit tests
  for the toggle and the two patient-facing copy changes.
- **Docs:** `docs/modules/doctor.md` and `docs/modules/patient.md`.
