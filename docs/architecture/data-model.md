# Data Model

The full entity-relationship diagram below is generated directly from `apps/api/prisma/schema.prisma`
by `pnpm --filter api run generate:data-model-diagram` (wired next to `openapi:generate`, and
checked for staleness in CI the same way — see [Deployment](/architecture/deployment)). Table
and column names are the actual PostgreSQL names (`@@map`/`@map`), not the Prisma field names.

Each table belongs to one of three capabilities documented per module:

- **Accounts & sessions** (`users`, `sessions`) — see [Authentication & Authorization](/architecture/auth).
- **Profiles & catalog** (`patient_profiles`, `doctor_profiles`, `specializations`,
  `doctor_specializations`) — see the [Patient](/modules/patient), [Doctor](/modules/doctor),
  and [Admin](/modules/admin) module pages.
- **Doctor availability** (`availability_rules`, `availability_exceptions`) — see the
  [Doctor](/modules/doctor) module page.
- **Symptom catalog** (`symptoms`, `symptom_specializations`) — reference data for guided
  matching, see the [Patient](/modules/patient#matching-algorithm) module page.
- **Appointments** (`appointments`, `appointment_symptoms`) — booking, rescheduling, and
  cancelling, see the [Patient](/modules/patient#booking-an-appointment) and
  [Doctor](/modules/doctor#managing-bookings) module pages.
- **Notifications** (`notifications`) — appointment-event notifications and reminders, delivered
  live over the realtime gateway; see [Notifications & Real-time](/architecture/realtime).

<!--@include: ./_generated-erd.md-->

## Notes

- `users.role` is fixed at creation and never changes through any public endpoint — there is no
  public way to create or promote an `ADMIN` account (see
  [Authentication & Authorization](/architecture/auth)).
- `sessions` stores only a SHA-256 hash of the session token, never the token itself.
- `patient_profiles.user_id` and `doctor_profiles.user_id` are both the primary key and the
  foreign key to `users`: a user has at most one profile, and which one depends on `users.role`.
- `doctor_specializations` is a plain many-to-many join table between `doctor_profiles` and the
  fixed `specializations` catalog (13 rows, inserted by migration — see
  [Specializations](/modules/doctor)).
- `doctor_profiles.timezone` is an IANA time zone string (default `UTC`) that `availability_rules`'
  `start_minute`/`end_minute` (minutes since local midnight) are interpreted in.
  `availability_exceptions` (time off) stores instants directly, already in UTC. Nothing about
  bookable slots is stored — they're computed on every read (see
  [Doctor](/modules/doctor#availability)).
- `symptoms` and `symptom_specializations` are reference data (53 symptoms, 74 weighted links,
  inserted by migration like `specializations`) — read-only, and never returned with `keywords`
  or `weight` to a client (see [Patient](/modules/patient#matching-algorithm)).
- `appointments` carries two PostgreSQL exclusion constraints not expressible in Prisma's schema
  language, added by hand in the `add_appointments` migration's SQL: no two `BOOKED` rows for the
  same `doctor_id`, and no two `BOOKED` rows for the same `patient_id`, may have overlapping
  `[starts_at, ends_at)` ranges. This is the database-level guarantee against double-booking under
  concurrent requests — see [Patient](/modules/patient#booking-an-appointment). `rescheduled_from_id`
  self-references the appointment a row replaced, forming the reschedule chain a detail view walks.

  ```sql
  ALTER TABLE appointments ADD CONSTRAINT appointments_doctor_no_overlap
    EXCLUDE USING gist (doctor_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&)
    WHERE (status = 'BOOKED');
  ALTER TABLE appointments ADD CONSTRAINT appointments_patient_no_overlap
    EXCLUDE USING gist (patient_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&)
    WHERE (status = 'BOOKED');
  ```

- `notifications.dedupe_key` is unique but nullable: appointment-event notifications leave it
  unset (any number of `NULL`s is allowed in a unique index), while reminders set
  `reminder:{24h|1h}:{appointmentId}:{userId}` so re-running the reminder cron can never create a
  duplicate — see [Notifications & Real-time](/architecture/realtime). `data` is a free-form JSON
  blob (`startsAt`, `previousStartsAt`, `counterpartName`, `reason`) the web formats in the
  viewer's own time zone; the server never bakes a formatted time into `title`/`body`.
