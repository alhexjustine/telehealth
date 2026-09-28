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
- **Consultations & records** (`consultation_sessions`, `consultation_notes`, `prescriptions`) —
  the workspace state machine, and the doctor's notes and prescriptions, locked once the session
  is `COMPLETED`; see [Clinical Access](/architecture/clinical-access).
- **Prescription refills** (`prescription_refill_requests`) — a patient's request to renew a past
  prescription and the treating doctor's decision, without reopening the locked record it points
  to; see the [Patient](/modules/patient#requesting-a-prescription-refill) and
  [Doctor](/modules/doctor#refill-requests) module pages.
- **Doctor favorites** (`doctor_favorites`) — a patient's bookmarked doctors, purely organizational
  (no effect on search ranking or matching); see the
  [Patient](/modules/patient#favorite-doctors-and-book-again) module page.
- **Audit log** (`audit_logs`) — one append-only entry per administrator action and admin
  sign-in; see the [Admin](/modules/admin#audit-log) module page.

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
- `consultation_sessions.appointment_id` is both the primary key and the foreign key to
  `appointments`: one row per appointment, created lazily on the first `join` (a missing row means
  `SCHEDULED`) rather than at booking time, so the booking code never has to know about the
  consultation workspace. `consultation_notes.appointment_id` is likewise the note's own primary
  key — one note per appointment, upserted in place rather than versioned.
- `prescriptions` is the one table here with its own `id`, since an appointment can have several;
  `@@index([appointment_id])` backs both the workspace read and the 20-per-consultation limit
  check (`RecordsService`, application-level, not a database constraint).
- Every write to `consultation_sessions`, `consultation_notes`, or `prescriptions` happens inside a
  transaction that first takes `SELECT ... FOR UPDATE` on the `consultation_sessions` row
  (`apps/api/src/consultations/session-lock.ts`), so a concurrent completion can never race past a
  note or prescription edit, or vice versa — see [Clinical Access](/architecture/clinical-access).
- `prescription_refill_requests` never mutates the `prescriptions` row it points to, or the
  appointment's `consultation_notes`: deciding a request (`status`, `doctor_note`, `decided_at`,
  `decided_by_id`) is recorded on the request itself, which *is* the "this was renewed" record —
  see [Patient](/modules/patient#requesting-a-prescription-refill). At most one `PENDING` request
  per prescription is enforced at the application level (a count-then-create inside one
  transaction), not by a database constraint — unlike appointment overlap, there's no concurrent
  double-booking race to close here.
- `appointments.status` gained `NOT_HELD` (a past `BOOKED` appointment an administrator resolved
  instead of leaving flagged forever) alongside a new `resolution_reason` column, kept separate
  from `cancellation_reason` since the appointment was never cancelled — see
  [Admin](/modules/admin#appointment-oversight).
- `audit_logs` is append-only: a `BEFORE UPDATE OR DELETE` trigger (`audit_logs_no_update_delete`,
  added by hand in its migration's SQL — Prisma's schema language can't express a trigger) raises
  an exception for any row-level change, and no API route can reach it either (only `GET` routes
  exist under `/admin/audit`). `before`/`after` hold only the allow-listed fields an action
  actually changed (`diffFields`, `apps/api/src/audit/diff-fields.ts`) — never password hashes,
  session tokens, or clinical content. `actor_id` is `ON DELETE RESTRICT`: users are never
  hard-deleted, so an audit entry's actor is always resolvable. `entity_id` has no foreign key
  since its target table varies with `entity_type` (`User`, `DoctorProfile`, or `Appointment`).
  `TRUNCATE` bypasses the trigger (it isn't a row event); only the e2e test suite's
  database-reset helper does this, and the application itself never truncates. See
  [Admin](/modules/admin#audit-log).

  ```sql
  CREATE FUNCTION audit_logs_immutable() RETURNS trigger AS $$
  BEGIN RAISE EXCEPTION 'audit_logs is append-only'; END; $$ LANGUAGE plpgsql;
  CREATE TRIGGER audit_logs_no_update_delete BEFORE UPDATE OR DELETE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION audit_logs_immutable();
  ```
