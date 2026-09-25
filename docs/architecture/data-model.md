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
