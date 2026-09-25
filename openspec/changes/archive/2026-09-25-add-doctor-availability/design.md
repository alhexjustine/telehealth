# Design

## Context

This change builds on `add-authentication`, which provides the following:
- `DoctorProfile`, with `consultationMinutes` (15/20/30/45/60), `verificationStatus`, and
  `userId` as its primary key.
- The global deny-by-default `SessionAuthGuard`, plus the `@Roles()`, `@CurrentUser()` and
  `@Public()` decorators.
- `configureApp()`, snake_case Prisma mapping, e2e helpers (a cookie agent and table
  truncation), and the generated ER-diagram docs page.

If `add-authentication` is still being implemented when this change starts, read its final code
first and adapt names, keeping the behavior in the specs.

The requirements are in `specs/doctor-availability/spec.md`. Booking does not exist yet.

## Goals / Non-Goals

**Goals:**
- A pure, fully unit-tested slot-generation function that booking can reuse unchanged, and
  extend by subtracting booked intervals.
- Correct time-zone and daylight-saving behavior.

**Non-Goals:**
- Excluding booked appointments from slots, and protecting existing bookings when rules change.
  `add-appointment-booking` adds both as modifications to this capability.
- Date-bounded or recurring-exception rules, such as "only in October" or "every other week".
- Patient-facing slot picker UI (`add-doctor-discovery`).

## Decisions

### Rules as local wall-clock ranges, slots computed on read
`AvailabilityRule` stores `weekday` (1–7, ISO, Monday = 1), `startMinute` and `endMinute`
(0–1440, multiples of 15). `DoctorProfile.timezone` holds an IANA string, default `UTC`.
Nothing about slots is stored; they're computed per request. Computing on read keeps changes to
consultation length or schedule effective immediately, with no regeneration job.
*Rejected:* materializing slot rows. It needs regeneration jobs and cleanup, and every schedule
edit becomes a data migration; the Postgres exclusion constraint planned for bookings makes slot
rows unnecessary for preventing conflicts.
*Rejected:* storing ranges in UTC. That breaks across daylight-saving changes, where a 09:00
start must stay 09:00 local.

### Replace-all schedule write
`PUT /doctors/me/availability { timezone, rules[] }` validates everything, then deletes and
inserts the rules and updates the time zone in one transaction. The UI edits the whole week at
once, so partial-update endpoints would only add conflict cases.
*Rejected:* CRUD per rule. Overlap validation would then span several requests.

### Time off as UTC instants
`AvailabilityException { id, doctorId, startsAt timestamptz, endsAt timestamptz, reason? }`.
The UI converts the doctor's local input to instants using the doctor's time zone. Overlapping
entries are allowed, since subtraction is idempotent.

### Slot generator
`generateSlots({ timezone, consultationMinutes, rules, exceptions, from, to, now, leadMinutes = 60 })`
lives in `availability/slot-generator.ts` and is pure: it takes no clock and does no I/O, and
`now` is injected.
1. Enumerate local dates covering `[from, to]`, padded by one day on each side for time-zone
   offsets.
2. For each rule on that weekday, resolve local start and end to instants with `@date-fns/tz`
   (`TZDate`). Skipped local times move forward, and repeated local times take their first
   occurrence (the spec's rule).
3. Step by `consultationMinutes` in real milliseconds while `slotEnd <= rangeEnd`.
4. Drop slots that overlap an exception (half-open intervals, so touching isn't overlap), that
   start before `now + leadMinutes`, or that fall outside `[from, to)`.
5. Sort and de-duplicate.

The lead time is a named constant (`SLOT_LEAD_MINUTES = 60`) exported for booking to reuse.
*Rejected:* Luxon, which is also good but would be a second date library once the web app uses
date-fns; and Temporal, which isn't available in the Node 24 runtime used by the containers.

### Validation
Class-validator DTOs handle field shape. A domain validator checks, per weekday, that end is
after start, that the length is at least `consultationMinutes`, and that ranges don't overlap
after sorting by start. It returns field-indexed errors (`rules[3]`) so the UI can highlight
them. Time zones are validated with `Intl.supportedValuesOf('timeZone')`, plus `UTC`, which that
list omits in some runtimes.

### Slot visibility
`GET /doctors/{doctorId}/slots?from&to` accepts any signed-in role. The service returns 404 when
the target isn't a doctor, or isn't `APPROVED` and isn't the caller themselves. This returns the
same error for "not found" and "not visible", so existence isn't revealed.

### Consultation length change vs. existing ranges
If a doctor raises their consultation length above an existing range's length, that range stops
producing slots. It isn't rejected, since the profile endpoint shouldn't have to know about
availability. The schedule page warns about ranges shorter than the consultation length.

### API surface
| Method | Path | Access |
|---|---|---|
| GET | `/doctors/me/availability` | DOCTOR |
| PUT | `/doctors/me/availability` | DOCTOR |
| POST | `/doctors/me/availability/exceptions` | DOCTOR → 201 |
| DELETE | `/doctors/me/availability/exceptions/{id}` | DOCTOR → 204 / 404 |
| GET | `/doctors/{doctorId}/slots?from=&to=` | any signed-in role |

### Web
- `/doctor/schedule`, added to the doctor navigation.
- The time-zone selector is a searchable select over `Intl.supportedValuesOf('timeZone')`,
  preselected to `Intl.DateTimeFormat().resolvedOptions().timeZone` when the saved value is still
  the default and no rules exist.
- The weekly editor has seven weekday rows, each a list of `start`/`end` selects in 15-minute
  steps, with add and remove buttons and a "copy Monday to weekdays" shortcut.
- The client-side zod schema mirrors the domain validator.
- Time off uses native `datetime-local` inputs, interpreted in the doctor's time zone (not the
  browser's) and converted to UTC before sending.
- The preview calls the slots endpoint with the doctor's own ID for the next 7 days, grouped by
  local date and rendered in the doctor's time zone.
- `date-fns` and `@date-fns/tz` are used for formatting and conversion.

## Risks / Trade-offs

- [Time-zone data differences between Node and browsers] → The server is authoritative; the UI
  only displays what the server returns and converts the time-off input. The tests pin the
  daylight-saving dates for 2026.
- [Per-request computation cost] → At most 31 days × a handful of ranges, which is trivial.
- [Doctors in pending status configure schedules nobody sees] → This is intended; it lets them
  be ready at approval. The UI explains it with the existing verification notice.

## Migration Plan

Additive: two tables and one column with a default. Existing doctors get `UTC` and no rules.

## Documentation impact

- `docs/modules/doctor.md`: an availability overview, an L2 view of the schedule and preview
  flows, the new tables in the ER diagram, and a short explanation of the slot algorithm
  (including the daylight-saving rules).
- `docs/architecture/c4-component.md`: an Availability component (done), and Scheduling split
  into Availability (done) and Booking (planned).
- Regenerate `docs/architecture/data-model.md` and the OpenAPI client.
- `docs/index.md`: the doctor availability feature moves to done.
