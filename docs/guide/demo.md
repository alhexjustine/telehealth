# Demo guide

A realistic, entirely fictional dataset loads automatically the first time the local stack starts
(`DEMO_DATA=true`, the Docker Compose default), so the app can be explored — or recorded for the
demo video — without first creating doctors, approving them, or building schedules by hand.

## Demo accounts

Every demo account uses the reserved domain `demo.telehealth.local` and shares one password. The
pre-provisioned administrator uses the credentials configured for the stack (`ADMIN_EMAIL`/
`ADMIN_PASSWORD`, defaulting to `admin@telehealth.local` / `ChangeMe-Admin-2026` — see the
repository `README.md`).

| Role    | Email                            | Password             | Notes                                              |
| ------- | --------------------------------- | --------------------- | --------------------------------------------------- |
| Admin   | `admin@telehealth.local`          | `ChangeMe-Admin-2026` | Pre-provisioned; not part of the demo domain        |
| Patient | `patient@demo.telehealth.local`   | `Demo-Password-2026`  | Primary demo patient — complete profile, full history |
| Doctor  | `doctor@demo.telehealth.local`    | `Demo-Password-2026`  | Primary demo doctor — Dr. Maria Santos, General Practice, approved |

The full roster (11 doctors, 4 patients — see below) all share the `Demo-Password-2026` password.
Every doctor's email local part names their specialization (e.g. `dr.cardiology@demo.telehealth.local`)
except the primary doctor above and the review-status examples below.

## What's in the dataset

- **8 approved doctors**, one per specialization (General Practice, Cardiology, Pediatrics,
  Dermatology, Neurology, Psychiatry, Obstetrics & Gynecology, Internal Medicine), each with a
  weekly schedule. Most are in the `Asia/Manila` time zone; `dr.internalmed@demo.telehealth.local`
  (Dr. Robert Tan) is in `America/New_York`, so doctor search and slot display can be shown working
  across time zones.
- **1 pending doctor** (`dr.pending@demo.telehealth.local`, Endocrinology), **1 rejected doctor**
  (`dr.rejected@demo.telehealth.local`, Orthopedics, with a review note), and **1 suspended
  doctor** (`dr.suspended@demo.telehealth.local`, Gastroenterology) — for the admin's doctor-review
  and user-management pages.
- **4 patients**: the primary demo patient (complete profile and medical history), a patient under
  18, a patient with an incomplete profile (so the "complete your profile" prompt has something to
  show), and a suspended patient.
- For the primary demo patient: 2 completed consultations with notes and prescriptions, 2 upcoming
  booked appointments, 1 cancelled appointment, and 1 rescheduled pair (a cancelled original plus
  its booked successor).
- 2 invalid bookings for the administrator to resolve: one appointment that ended without being
  completed, and one upcoming appointment with a doctor who was later rejected.
- A few unread notifications for the primary demo patient and doctor, and administrator audit
  entries for the approvals, the rejection, and the suspensions the dataset implies.

All appointment times are computed relative to when the dataset is loaded, so they stay "upcoming"
or "recently completed" no matter when you start the stack.

Loading is idempotent — restarting the stack (`docker compose down` without `-v`, then
`docker compose up`) leaves the dataset, and anything you changed during a previous session,
exactly as it was.

All three `pnpm demo:*` commands below are standalone scripts (like `admin:provision`): they read
`DATABASE_URL` directly from the shell environment rather than loading `apps/api/.env` themselves,
so it must be exported first (`set -a; source apps/api/.env; set +a` — see the repository
README's "Local development" section). Running them against the containerized stack doesn't need
this: the container already has `DATABASE_URL` set.

## Staging a live consultation

To show the consultation workspace working live (rather than pre-completed), stage an appointment
between the primary demo patient and doctor that starts 10 minutes from now:

```bash
# Native dev, against pnpm db:up's Postgres
pnpm demo:live

# Against the containerized stack
docker compose exec api node dist/scripts/seed-demo.js --live-consultation
```

Running it again replaces the previously staged appointment (there is only ever one), without
touching anything else. Sign in as the demo doctor and demo patient in two browser windows, wait
for the appointment to enter its join window, and walk through joining, starting, writing a note
and a prescription, and completing the session.

## Removing the demo dataset

```bash
# Native dev
pnpm demo:reset

# Containerized stack
docker compose exec api node dist/scripts/seed-demo.js --reset
```

This removes every account whose email ends in `@demo.telehealth.local` and everything it owns
(profiles, sessions, appointments, notifications, consultation records) — any non-demo accounts
and their data are left untouched. Audit log entries are append-only and are kept even for demo
actors, since the audit log itself is meant to be a permanent record.

## Suggested video walkthrough

A ≤15-minute demo video should show the core journey plus each area the brief evaluates on
(functionality, product/design sense, code quality, presentation). A suggested order, using the
demo accounts above (stage a live consultation first so step 6 is real, not pre-recorded):

1. **Product website** — landing page, value proposition, how-it-works, the fictional-prototype
   disclaimer, and the privacy/terms pages.
2. **Patient registration and profile** — register a new patient live, or sign in as
   `patient@demo.telehealth.local` to show a complete profile and medical history.
3. **Doctor discovery** — Find a doctor (search/filter/sort) and Find care (guided symptom
   matching), landing on the primary demo doctor's (Dr. Maria Santos) profile and slot picker.
4. **Booking, reschedule, cancel** — book a new appointment, then show the demo patient's existing
   rescheduled pair and cancelled appointment in Appointments.
5. **Doctor side** — sign in as `doctor@demo.telehealth.local`: schedule management, the
   appointments list, and a patient record view.
6. **Consultation workspace, live** — join the staged live consultation as both patient and
   doctor, start it, write a note and prescription, complete it, then show the patient's Records
   page with it.
7. **Notifications** — point out the unread notifications and, if timed right, a live toast from
   the previous steps.
8. **Admin console** — sign in as the administrator: the dashboard's operational counts, a pending
   doctor review, the invalid bookings the demo data seeded, user management (suspend/reactivate),
   and the audit log entries those actions produce.
9. **Resilience** — briefly show a loading state, an empty state (e.g. a fresh patient's
   Appointments page), and the recovery page (see [Testing & Quality](/architecture/testing) for
   how these are verified).
10. **Code quality and architecture** — a quick tour of the [Architecture](/architecture/c4-context)
    docs and the OpenSpec change history (`openspec/specs/`, `openspec/changes/`), which double as
    the project's design record.

## Demo password disclosure

`Demo-Password-2026` is intentionally public — it only ever applies to the reserved
`@demo.telehealth.local` domain in a fictional local prototype, never to a real account.
