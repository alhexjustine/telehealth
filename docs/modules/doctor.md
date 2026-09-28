# Doctor

> Accounts, sign-in/out, profile (including the admin re-review rule), availability/schedule
> management, booking oversight (own appointments, cancellation, schedule protection against
> existing bookings), in-app notifications, running consultations, and role-scoped patient records
> are done (`add-authentication`, `add-doctor-availability`, `add-appointment-booking`,
> `add-notifications`, `add-consultations-and-records`, `add-admin-console`).

## Module Overview

A visitor registers as a doctor with an email, password, name, at least one specialization from
the catalog, and a license number; the account is signed in immediately, and the profile starts
in verification status `PENDING` until an administrator reviews it (see
[Admin](/modules/admin#doctor-profile-review)). The doctor area shows a notice while the profile is
`PENDING` or `REJECTED` (with the administrator's review note, once rejected) explaining that it
isn't yet visible to patients. Doctors view and edit their own profile — name, specializations,
biography, years of experience, license number, and consultation length — but cannot change their
own verification status. Changing an `APPROVED` doctor's license number or specialization set
sends the profile back to `PENDING` review (see
[Admin](/modules/admin#re-review-on-credential-change)); any other edit leaves `APPROVED` alone.

### Availability

Doctors declare when they work as a weekly schedule in their own time zone — one or more
non-overlapping working ranges per weekday — plus time off (specific date-time ranges with no
slots). The API turns that, plus the profile's consultation length, into concrete bookable slots
on every read; nothing about slots is stored, so a schedule or consultation-length change takes
effect on the very next request. A doctor can manage and preview their own schedule while still
`PENDING`; everyone else only sees slots for `APPROVED` doctors (a pending/rejected doctor's slots
404 the same way a non-existent doctor ID would, so existence isn't revealed).

The `/doctor/schedule` page has a time-zone selector (defaulting to the browser's time zone before
the first save), a weekly range editor with inline validation, a time-off list, and a preview of
the doctor's own slots for the next seven days.

## Managing bookings

`/doctor/appointments` lists the doctor's own appointments in **Upcoming**/**Past** tabs, each
card showing the patient's name, age, reason, and any symptoms carried over from guided matching,
plus a "Join consultation" action once the join window is open (see
[Clinical Access](/architecture/clinical-access)) and a link to the patient's full record. The
doctor home page's **Today** card lists the day's appointments (by the doctor's own local date) in
start order, with the same join action.

The home page also has an "In" / "Out" toggle (`acceptingBookings` on the doctor's profile,
defaulting to `true`) that pauses or resumes new bookings without touching verification status,
account status, or any existing appointment. While "Out", `BookingRules.assertBookable()` rejects
new bookings and reschedules with `409 DOCTOR_NOT_ACCEPTING_BOOKINGS`, and the doctor's slots are
hidden from patients (`GET /doctors/{id}/slots` returns `[]` to anyone but the doctor themselves,
who still previews their own full schedule). The doctor still appears in search, their profile
still opens, and guided matching still considers them — each just shows no next-available time and,
on search/the profile page, a plain "Not accepting bookings" notice instead. See
[Patient](/modules/patient#booking-an-appointment) for what a patient sees.

A doctor cancels their own upcoming `BOOKED` appointment with a required reason (5-500
characters); `POST /appointments/{id}/cancel` returns `400` if it's missing or too short. See
[Patient](/modules/patient#booking-an-appointment) for the shared booking rules, error codes, and
the database-level double-booking guarantee — the doctor side of booking is that same
`AppointmentsController`/`AppointmentsService`, scoped to the caller's own role.

### Schedule protection

Saving a weekly schedule or adding time off is rejected with `409` and code
`SCHEDULE_CONFLICTS_WITH_BOOKINGS` when it would leave an upcoming `BOOKED` appointment no longer
covered by any working range (schedule) or would overlap one (time off) — the rejection body lists
the affected appointments (`id`, `startsAt`, `endsAt`, patient name), which the schedule and
time-off forms render as a list linking to each appointment's detail. This is deliberate: a doctor
can't silently orphan a patient's booking by editing their hours; they cancel it first. See the
[Slot Algorithm](#slot-algorithm) below for how the containment check reuses the same local-time
resolution as slot generation (`isBookingContained` in
`apps/api/src/availability/booking-containment.ts`), including across a daylight-saving change.

## Notifications

A new booking, a reschedule, or a patient cancelling notifies the doctor ("New booking",
"Appointment rescheduled", "Appointment cancelled"), plus 24h/1h reminders before every `BOOKED`
appointment — delivered live while signed in, and always visible in the notification bell and
`/doctor/notifications`. See [Notifications & Real-time](/architecture/realtime) for the event →
transaction → commit → delivery model and the socket.io gateway.

## Running a consultation

`/consultations/:appointmentId` is where the doctor runs the appointment: appointment context, a
state timeline, presence dots for both participants, and — once the patient has joined —
"Start consultation" (disabled until then, with a hint), a notes editor (findings, assessment,
plan, patient summary — four textareas, autosaved on a 1-second debounce), a prescriptions table
(add/edit/remove: medication, dosage, frequency, duration, optional instructions; capped at 20 per
consultation), and "Complete consultation" (a confirm dialog, disabled while the patient summary
is blank). Completing sets the appointment `COMPLETED`, locks the note and prescriptions against
any further edit, and notifies the patient live. See
[Clinical Access](/architecture/clinical-access) for the full state machine, every guard and
rejection code, and who else can read a completed note (continuity of care).

When the appointment was booked for one of the patient's dependents (`add-dependent-booking`), the
workspace's identity and medical summary reflect that dependent — name, age, conditions,
allergies, medications — not the account holder's; a relationship badge (Child/Parent/Spouse/
Other) makes this explicit. Joining, starting, and completing are unaffected: the account holder
is still who is actually signed in and doing all of it.

## Patient records

`/doctor/patients/:patientId`, reachable from an appointment card, the appointment detail page, or
the workspace, shows one specific person's profile, medical history, every appointment with this
doctor, and — for continuity of care — that same person's completed consultations with *any*
doctor, each linking back into that consultation's workspace for the full note. This requires the
doctor to have (or have had) a `BOOKED` or `COMPLETED` appointment with that same person; a doctor
with only a cancelled appointment, or none at all, gets a `404` (see
[Clinical Access](/architecture/clinical-access)).

When the appointment was for one of the account's dependents, the link carries a `?dependentId=`
query parameter and the page shows that dependent's own record instead of the account holder's
(`add-dependent-booking`). A treating relationship established through one dependent, or through
the account holder themselves, does not extend to any other dependent or to the account holder —
each person's history is scoped independently, even though they share one account.

## Reviews

Once a patient's consultation is `COMPLETED`, they may leave a 1-5 star rating and an optional
comment for the doctor (`add-doctor-reviews`) — visible to any signed-in user on the doctor's
search card and profile, alongside an average computed from non-hidden reviews only. The doctor
sees the same rating/comment as everyone else, with no separate moderation ability over their own
reviews; an administrator can hide an abusive or identifying one (see
[Admin](/modules/admin#review-moderation)).

## Refill requests

`/doctor/refill-requests` lists the signed-in doctor's own `PENDING` prescription refill requests —
patient/dependent name, medication, the patient's note, and the consultation date — with approve
and deny actions, each taking an optional note (`add-prescription-refills`). Deciding a request
never reopens the original, locked consultation note or edits the prescription itself; it only
records the decision on the request itself, which the patient sees inline on their own record. A
doctor only ever sees requests from their own appointments, but eligibility to decide one reuses
the same continuity-of-care check `/doctor/patients/:patientId` uses, not a stricter "must be this
exact appointment's doctor" rule.

## L2 Container View

Reuses the [C4 L2 Container](/architecture/c4-container) diagram's `web` and `api` containers —
no new container is introduced. The flows this slice adds:

```mermaid
flowchart LR
  D((Doctor)) -->|"register / sign in / sign out"| W[Web: Doctor area]
  D -->|"view / edit profile"| W
  D -->|"set schedule, time off, preview slots"| W
  D -->|"view own appointments, cancel with reason"| W
  D -->|"bell, notifications page"| W
  D -->|"join, start, write notes/prescriptions, complete"| W
  D -->|"view a patient's record"| W
  D -->|"list / approve / deny refill requests"| W
  P((Patient)) -->|"view an approved doctor's slots"| W
  W -->|"REST/JSON, session cookie"| A["API: Auth, Doctors, Specializations, Availability, Appointments, Notifications, Consultations, Records, Refills"]
  W -->|"socket.io, session cookie"| RT[Realtime Gateway]
  A -->|"SQL"| DB[(PostgreSQL)]
  RT -->|"SQL (unread count)"| DB
  RT -->|"consultation:state, consultation:presence"| W
```

## Data Model

The doctor-owned slice of the full [Data Model](/architecture/data-model):

```mermaid
erDiagram
  users {
    string id PK
    string email UK
    string role
    string status
  }
  doctor_profiles {
    string user_id PK,FK
    string first_name
    string last_name
    string license_number UK
    int consultation_minutes
    string verification_status
    string review_note
    string timezone
  }
  availability_rules {
    string id PK
    string doctor_id FK
    int weekday
    int start_minute
    int end_minute
  }
  availability_exceptions {
    string id PK
    string doctor_id FK
    datetime starts_at
    datetime ends_at
    string reason
  }
  specializations {
    string id PK
    string slug UK
    string name UK
  }
  doctor_specializations {
    string doctor_id PK,FK
    string specialization_id PK,FK
  }
  appointments {
    string id PK
    string patient_id FK
    string doctor_id FK
    datetime starts_at
    datetime ends_at
    string status
  }
  notifications {
    string id PK
    string user_id FK
    string type
    string title
    string body
    string appointment_id FK
    string dedupe_key UK
    datetime read_at
    datetime created_at
  }
  consultation_sessions {
    string appointment_id PK,FK
    string state
    datetime patient_joined_at
    datetime doctor_joined_at
    datetime started_at
    datetime completed_at
  }
  consultation_notes {
    string appointment_id PK,FK
    string findings
    string assessment
    string plan
    string patient_summary
  }
  prescriptions {
    string id PK
    string appointment_id FK
    string medication
    string dosage
    string frequency
    string duration
    string instructions
  }
  users ||--o| doctor_profiles : "user"
  doctor_profiles ||--o{ availability_rules : "doctor"
  doctor_profiles ||--o{ availability_exceptions : "doctor"
  doctor_profiles ||--o{ doctor_specializations : "doctor"
  specializations ||--o{ doctor_specializations : "specialization"
  doctor_profiles ||--o{ appointments : "doctor"
  users ||--o{ notifications : "recipient"
  appointments ||--o{ notifications : "about"
  appointments ||--o| consultation_sessions : "appointment"
  appointments ||--o| consultation_notes : "appointment"
  appointments ||--o{ prescriptions : "appointment"
```

`availability_rules.weekday` is ISO (Monday = 1 … Sunday = 7); `start_minute`/`end_minute` are
minutes since local midnight (0-1440, steps of 15), interpreted in `doctor_profiles.timezone`.
`availability_exceptions` (time off) stores `starts_at`/`ends_at` as UTC instants directly — the
web app converts the doctor's local input to and from UTC using their chosen time zone.
`consultation_sessions`/`consultation_notes`/`prescriptions` are trimmed here to their
doctor-relevant fields — see the [full Data Model](/architecture/data-model) and
[Clinical Access](/architecture/clinical-access) for the complete schema, the state machine, and
every access rule.

## Slot Algorithm

`GET /doctors/{doctorId}/slots?from&to` (and the doctor's own `PUT`/`GET
/doctors/me/availability`) are backed by a pure function, `generateSlots`, that takes no clock and
does no I/O — `now` is injected, which is what makes its daylight-saving behavior unit-testable
against fixed dates. For a requested range (at most 31 days):

1. Enumerate every local calendar date the range covers in the doctor's time zone, padded by one
   day on each side.
2. For each weekly rule on that weekday, resolve its local start and end time of day to instants.
   A local time skipped by a daylight-saving change (spring forward) moves forward to the first
   valid time after it; a local time that occurs twice (fall back) uses its first occurrence.
3. Lay out consecutive slots of the doctor's consultation length from the range's start instant,
   stepping in real elapsed minutes — not local wall-clock minutes — so a slot that spans a
   daylight-saving change still lasts the intended number of real minutes. A slot is kept only if
   it ends at or before the range's end instant.
4. Drop slots that overlap any time off (half-open intervals — touching an edge isn't overlap),
   that overlap any of the doctor's `BOOKED` appointments, that start less than 60 minutes from
   now, or that fall outside the requested range. A slot freed by a cancellation is offered again
   on the very next request, same as any other schedule change.

For example, a doctor in `America/New_York` with a 60-minute consultation length and a Sunday
01:00–04:00 range: on the Sunday clocks spring forward (02:00 skipped), that range produces
exactly two 60-real-minute slots, starting at 01:00 and 03:00 local time. On the Sunday clocks
fall back (01:00 repeats), a 01:00–03:00 range produces three 60-real-minute slots: 01:00 before
the change, 01:00 after it, and 02:00.

Raising a doctor's consultation length above an existing range's length doesn't reject the
range — it just stops producing slots until the range or the consultation length changes back;
the schedule page warns about this in the editor.

See [Authentication & Authorization](/architecture/auth) for the account/session model this all
sits behind.
