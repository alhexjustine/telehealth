# Design

## Context

This change builds on `add-authentication` (profiles, completeness, guards),
`add-doctor-availability` (the pure `generateSlots`, `SLOT_LEAD_MINUTES`, the replace-all schedule
write, time off), and `add-doctor-discovery` (the visible-doctor helper, `NextSlotService`, the
symptom catalog, and the slot picker with a disabled "Book" button).

`btree_gist` is enabled by the first migration. The global exception filter already maps
PostgreSQL `23P01` to 409. If names in those changes differ once implemented, adapt to the real
code and keep the behavior in the specs.

The requirements are in `specs/appointments`, plus the modified `specs/doctor-availability` and
`specs/local-deployment`.

## Goals / Non-Goals

**Goals:**
- Make double-booking impossible at the database level, not just unlikely.
- One booking-rules module shared by book and reschedule, so the rules can't diverge.
- Stable error codes that the web can switch on.

**Non-Goals:**
- Notifications for booking events (`add-notifications` will hook into this service's
  transactions).
- Consultation states and completing appointments (`add-consultations-and-records`, which sets
  `COMPLETED`).
- Admin oversight and admin cancellation (`add-admin-console`).
- Waiting lists, recurring appointments, and payments.

## Decisions

### Appointment model
```
enum AppointmentStatus { BOOKED CANCELLED COMPLETED }

Appointment  id uuid, patientId → PatientProfile.userId, doctorId → DoctorProfile.userId,
             startsAt timestamptz, endsAt timestamptz, reason varchar(500),
             status @default(BOOKED), cancelledAt?, cancelledById? → User, cancellationReason?,
             rescheduledFromId? → Appointment (unique), createdAt, updatedAt
             @@index([doctorId, startsAt]) @@index([patientId, startsAt])
AppointmentSymptom  appointmentId → Appointment (cascade), symptomId → Symptom, @@id([appointmentId, symptomId])
```
`COMPLETED` is included now, so the next change doesn't need an enum migration. Nothing in this
change sets it.

### Exclusion constraints in raw SQL
```
ALTER TABLE appointments ADD CONSTRAINT appointments_doctor_no_overlap
  EXCLUDE USING gist (doctor_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&)
  WHERE (status = 'BOOKED');
ALTER TABLE appointments ADD CONSTRAINT appointments_patient_no_overlap
  EXCLUDE USING gist (patient_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&)
  WHERE (status = 'BOOKED');
ALTER TABLE appointments ADD CONSTRAINT appointments_valid_range CHECK (ends_at > starts_at);
```
These are added in the migration SQL after the Prisma-generated table DDL. The half-open ranges
let back-to-back appointments touch. The constraint expressions aren't in the Prisma schema, so
verify that a following `prisma migrate dev` doesn't generate a migration that drops them. If it
does, find and document the Prisma 7 workaround, and pin it with the constraint-existence test
below.
*Rejected:* a unique index on `(doctor_id, starts_at)`. It misses partial overlaps once
consultation lengths change. *Rejected:* `SERIALIZABLE` transactions plus retries: more moving
parts, and a direct insert could still bypass them.

### Booking rules as one module
`BookingRules.assertBookable(tx, { patientId, doctorId, startsAt, excludeAppointmentId? })` runs,
in order:
1. Profile complete, else `PROFILE_INCOMPLETE`.
2. Doctor visible, else 404.
3. `startsAt ≤ now + 60 days`, else `BEYOND_BOOKING_HORIZON`.
4. Fewer than 5 upcoming booked appointments, excluding the rescheduled one, else
   `BOOKING_LIMIT_REACHED`.
5. `startsAt` is exactly the start of a slot returned by `generateSlots` for
   `[startsAt, startsAt + consultation)`, with booked intervals excluding `excludeAppointmentId`,
   else `SLOT_UNAVAILABLE`.
6. No overlapping booked patient appointment (excluding the rescheduled one), else
   `PATIENT_CONFLICT`.

Book calls it and then inserts. Reschedule, in one transaction, calls it with
`excludeAppointmentId`, sets the original to `CANCELLED` ("Rescheduled", cancelled by the
patient), and inserts the new row with `rescheduledFromId`. Because the constraints only apply to
`BOOKED` rows, cancelling first lets the new row reuse overlapping time. A `23P01` error from the
insert is caught in the service and rethrown as `SLOT_UNAVAILABLE`, or as `PATIENT_CONFLICT` when
the constraint name is `appointments_patient_no_overlap`.

The constants `BOOKING_HORIZON_DAYS = 60`, `MAX_UPCOMING_PER_PATIENT = 5`, and
`RESCHEDULE_CUTOFF_MINUTES = 120` live in one `booking.constants.ts`.

### Error codes
Add a `DomainError(httpStatus, code, message)` class, or `ConflictException` with a `code`
payload. The global filter copies `code` into the body when present. Codes are listed in one
`error-codes.ts` enum exported to the API docs. Swagger documents the error schema with an
optional `code`.
*Rejected:* inferring codes from message text, which breaks on any wording change.

### Availability changes
- `generateSlots` gains a `booked: Interval[]` input and drops overlapping slots (half-open). The
  slots endpoint and `NextSlotService` load `BOOKED` intervals for the range, batched per doctor
  set.
- Schedule save: in the same transaction as the replace, load upcoming `BOOKED` appointments and
  check each is fully contained in some new range on its local date in the new time zone, using
  the same local-to-instant resolution as `generateSlots` (extract a shared helper). If any fails,
  roll back with `SCHEDULE_CONFLICTS_WITH_BOOKINGS` and `details.appointments[]`
  (`id`, `startsAt`, `endsAt`, patient display name).
- Time-off create: reject overlapping `BOOKED` appointments the same way.

### Listing and detail
`GET /appointments?scope=upcoming|past&page&pageSize` is role-aware: the patient filter is
`patientId = me`, the doctor filter is `doctorId = me`, and admins get 403 here (their oversight
endpoints come later).

`GET /appointments/{id}` is participants only; anyone else gets 404. The detail includes the
history chain: walk `rescheduledFromId` backwards and the reverse relation forwards.

Patient age is computed from `birthDate` at request time. Doctors see the patient's first and
last name, age, reason, and symptoms, but not the full medical history. That arrives with records
in `add-consultations-and-records`, under its own access rules.

### API surface
| Method | Path | Access |
|---|---|---|
| POST | `/appointments` | PATIENT → 201 |
| GET | `/appointments` | PATIENT, DOCTOR |
| GET | `/appointments/{id}` | participant |
| POST | `/appointments/{id}/reschedule` | PATIENT (own) → 201 |
| POST | `/appointments/{id}/cancel` | PATIENT or DOCTOR (own) → 200 |

### Web
- On the doctor profile page's slot picker, "Book" navigates to
  `/patient/doctors/:doctorId/book?start=<iso>&symptoms=<ids>`.
- The booking page shows the summary, a reason textarea (prefilled as
  "Symptoms: Headache, Cough. " when symptoms are carried over), and symptom chips that can be
  removed. `PROFILE_INCOMPLETE` shows an alert and a profile link. `SLOT_UNAVAILABLE` shows an
  alert and a refreshed mini slot picker. On success, a toast is shown and the page navigates to
  `/patient/appointments`.
- `/patient/appointments`:
  - Tabs, each with a list of cards: date and time in the patient's time zone, doctor, status
    badge, reason.
  - Reschedule opens a dialog with the same doctor's slot picker (14 days).
  - Cancel opens a dialog with an optional reason.
  - Buttons are disabled with a tooltip, following the rules (2-hour cutoff, started, not booked).
- `/patient/appointments/:id`: detail and history.
- `/doctor/appointments`: tabs; each card shows the patient's name, age, reason, and symptoms.
  Cancel requires a reason.
- Doctor home: the "Today" list (appointments whose local date in the doctor's time zone is
  today).
- The doctor schedule page and time-off form show a list of conflicting appointments, each
  linking to its detail, when the save fails with `SCHEDULE_CONFLICTS_WITH_BOOKINGS`.
- The api-client exposes a typed helper to read `code` from error responses.

### Testing approach
- Unit tests: `generateSlots` with booked intervals (including the different-length scenario),
  the containment check for schedule protection across daylight-saving changes, and each
  `BookingRules` branch using an in-memory fake or the test database.
- e2e tests: every appointments scenario and every modified availability scenario.
  - "Concurrent bookings of the same slot": fire two booking requests in parallel with
    `Promise.all` from two patient agents. Assert exactly one 201 and one 409.
  - "Database rejects overlap directly": use `prisma.$executeRaw` to insert an overlapping row,
    and assert error `23P01`.
- Web tests: booking success and `SLOT_UNAVAILABLE` handling, the incomplete-profile state,
  reschedule disabled near start, and the doctor's today list.

## Risks / Trade-offs

- [Prisma might try to drop the raw exclusion constraints in future migrations] → An e2e test
  asserts the constraints exist (query `pg_constraint`), so any drift fails CI.
- [Slot-exact matching rejects bookings made from a stale UI after a consultation-length change]
  → The UI refreshes slots on `SLOT_UNAVAILABLE`, which is intended behavior.
- [Doctors can't reshape a schedule without cancelling bookings first] → This is deliberate, to
  protect patients. The conflict list makes the next step obvious.
- [Late cancellations are allowed until start] → This favors patient flexibility over no-show
  prevention; the docs note it as a product decision.

## Migration Plan

Additive tables and constraints. Existing data has no appointments.

## Documentation impact

- `docs/modules/patient.md` and `doctor.md`: booking and appointment management overviews, L2
  flows, the appointment tables in the ER diagram, and a booking sequence diagram showing the
  service checks and the database constraint as the final guard (including the concurrent
  scenario).
- `docs/architecture/c4-component.md`: Booking moves to done.
- `docs/architecture/auth.md` or a new "API conventions" section: the error `code` catalogue.
- Regenerate the data model page and the OpenAPI client. Mark booking as done in `docs/index.md`.
