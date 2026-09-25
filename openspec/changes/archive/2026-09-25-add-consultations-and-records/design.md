# Design

## Context

This change builds on earlier ones:
- `add-appointment-booking`: `Appointment` with status `BOOKED`/`CANCELLED`/`COMPLETED`, where
  `COMPLETED` is not yet set by anything; `DomainError` codes; participant-only appointment reads.
- `add-notifications`: `withNotifications`, `NotificationType` (a migration adds a value), the
  socket.io gateway with `user:{id}` rooms, session-authenticated handshakes, `joinRoom`/`emitToRoom`
  helpers, and the web `RealtimeProvider`.
- `add-authentication`: `PatientProfile` medical-history fields and the role guards.

If the implemented names differ from these, adapt to the real code and keep the behavior in the
specs. The requirements are in `specs/consultation-session` and `specs/medical-records`, plus
the addition to `specs/notifications`.

## Goals / Non-Goals

**Goals:**
- An explicit, testable state machine, with every transition guarded in one place.
- One access-policy module for clinical data, so "who can read what" is reviewable in a single
  file.

**Non-Goals:**
- Audio/video, chat messaging, and file attachments (the brief doesn't require them; bonus
  territory).
- No-show handling and amendments after completion. Past `BOOKED` appointments that never
  completed show as "Not held", and `add-admin-console` covers resolving invalid bookings.
- Access logging of clinical reads (noted as future work in the docs).

## Decisions

### Session model and lazy creation
```
enum SessionState { SCHEDULED JOINED IN_PROGRESS COMPLETED }
ConsultationSession  appointmentId PK → Appointment (cascade), state @default(SCHEDULED),
                     patientJoinedAt?, doctorJoinedAt?, startedAt?, completedAt?, updatedAt
ConsultationNote     appointmentId PK → Appointment (cascade), findings?, assessment?, plan?,
                     patientSummary?, updatedAt
Prescription         id uuid, appointmentId → Appointment (cascade), medication, dosage, frequency,
                     duration, instructions?, createdAt, updatedAt   @@index([appointmentId])
```
The session row is upserted on the first join. A missing row means `SCHEDULED`, which avoids
changing the booking code.
*Rejected:* storing session columns on `Appointment`. That mixes booking and clinical-session
concerns, and would make access rules harder to reason about.

### State machine
`consultation-state.ts` exports `transition(session, action, actor, now, appointment)` as a pure
function. It returns the new state and timestamps, or throws `DomainError` with the spec codes:
- `join`: participants only, window `[startsAt − 15m, endsAt + 30m]`, appointment `BOOKED`
- `start`: doctor only, from `JOINED`, and `patientJoinedAt` must be set
- `complete`: doctor only, from `IN_PROGRESS`, and a patient summary must exist (non-blank)

The service loads the appointment, session, and note in a transaction with
`SELECT … FOR UPDATE` on the session row, calls `transition`, persists, and, on complete, sets
`appointment.status = COMPLETED` and stages the patient notification through
`withNotifications`. The window constants are `JOIN_OPENS_BEFORE_MINUTES = 15` and
`JOIN_CLOSES_AFTER_MINUTES = 30`.

### Clinical access policy
All reads and writes of notes, prescriptions, workspace patient-summaries, and patient records go
through `ClinicalAccessPolicy`, in one file:
- `canViewWorkspace(user, appt)`: participant, and the appointment is not cancelled. A cancelled
  appointment returns `APPOINTMENT_NOT_ACTIVE`.
- `canWriteRecord(user, appt, session)`: the doctor on the appointment, with the session `JOINED`
  or `IN_PROGRESS`. A completed session returns `RECORD_LOCKED`; a scheduled one returns
  `SESSION_NOT_ACTIVE`.
- `canPatientReadRecord(user, appt)`: own appointment, and `COMPLETED`.
- `canDoctorReadPatient(doctorId, patientId)`: there exists a `BOOKED` or `COMPLETED` appointment
  between them.

Denial codes: patients and doctors outside the relationship get 404, so existence isn't
revealed. Admins are excluded by `@Roles(PATIENT, DOCTOR)` on every clinical route and get 403,
matching the spec.

### Real-time workspace
Clients emit `consultation:subscribe { appointmentId }`. The gateway checks
`canViewWorkspace`, then joins `appointment:{id}` and replies with the current presence. On
failure it acknowledges with an error and does not join the room.

Presence is tracked in memory per room: `Map<appointmentId, Map<userId, socketCount>>`. It emits
`consultation:presence { patientPresent, doctorPresent }` on join, leave, and disconnect. After
each committed transition, the service emits `consultation:state { state, timestamps }` to the
room.

Note and prescription edits are not broadcast. The patient sees them only once the consultation
is completed, which is when the spec says they become visible.

### API surface
| Method | Path | Access |
|---|---|---|
| GET | `/consultations/{appointmentId}` | participant (admin 403) |
| POST | `/consultations/{appointmentId}/join` | participant |
| POST | `/consultations/{appointmentId}/start` | doctor |
| POST | `/consultations/{appointmentId}/complete` | doctor |
| PUT | `/consultations/{appointmentId}/note` | doctor |
| POST | `/consultations/{appointmentId}/prescriptions` | doctor → 201 |
| PATCH / DELETE | `/consultations/{appointmentId}/prescriptions/{id}` | doctor |
| GET | `/records` | PATIENT (own, completed) |
| GET | `/records/{appointmentId}` | PATIENT (own, completed) |
| GET | `/patients/{patientId}/record` | DOCTOR (treating relationship) |

The workspace GET returns the patient-summary block only when the caller is the doctor. For the
doctor, it also returns the current note and prescriptions. For the patient, it returns the note
and prescriptions only when the consultation is completed.

### Web
- `/consultations/:appointmentId` is a focused layout with a minimal header and a back link. It
  is guarded to PATIENT or DOCTOR.
  - On mount: fetch the workspace, subscribe via the socket, and auto-join when inside the
    window. Before the window, show a countdown to `startsAt − 15m`.
  - Left column: appointment context, and a state timeline showing the four states with times.
  - Presence dots for both participants.
  - Doctor right column:
    - the patient summary card (age, conditions, allergies, medications)
    - the notes editor, with four textareas autosaved with a 1-second debounce and a
      "Saved · just now" indicator
    - the prescriptions table with add, edit, and remove
    - "Start consultation", disabled until the patient has joined, with a hint
    - "Complete consultation", with a confirm dialog; it is disabled while the summary is empty
  - Patient right column: "Waiting for the doctor…", then "In progress", then, when completed,
    the summary and prescriptions.
- "Join consultation" buttons appear on patient and doctor appointment cards, detail pages, and
  the doctor's today list when `now` is within the window. They are computed client-side from
  the same constants, exported by the api-client package or duplicated with a test.
- `/patient/records` and `/patient/records/:appointmentId` use print CSS (`@media print` hides
  navigation, one column).
- `/doctor/patients/:patientId` shows the profile, medical history, appointments with this
  doctor, and past consultations. It's linked from doctor appointment cards and the workspace.

### Testing approach
- Unit: every `transition` branch, including window edges at exactly −15m and +30m; every
  `ClinicalAccessPolicy` branch; the presence counter across multiple tabs.
- e2e: every scenario in all three specs. Time-dependent scenarios insert appointments with
  `startsAt` relative to `now` directly through Prisma, which bypasses the booking lead time.
  Socket scenarios use `socket.io-client`.
- Web: countdown before the window, the join button shown in the window, the doctor's
  Start-disabled-until-patient-joined state, Complete disabled without a summary, a mocked
  `consultation:state` event updating the patient view, and the print layout class present.

## Risks / Trade-offs

- [In-memory presence is lost on API restart] → Clients re-subscribe on reconnect, which
  rebuilds presence. There is one instance.
- [Doctors see other doctors' notes for their patients] → This is deliberate, for continuity of
  care, and it's gated by an active or completed treating relationship. It's documented on the
  records docs page as a policy choice.
- [Autosave races, with two tabs editing notes] → Last write wins on the whole note. That's
  acceptable for a single doctor, and the UI shows the save time.
- [Sessions left `IN_PROGRESS` forever if the doctor never completes] → They are visible to the
  doctor on the appointment. Admin resolution is in `add-admin-console`.

## Migration Plan

Additive: three tables and one enum value.

## Documentation impact

- `docs/modules/patient.md` and `doctor.md`: consultation and records overviews, the L2 flow
  (workspace plus socket), the three tables in the ER diagram, and a state-machine diagram
  (Mermaid `stateDiagram-v2`) with the guards.
- A new "Records access" section (on the patient and doctor module pages, or a shared
  `docs/architecture/clinical-access.md`): the access matrix and the continuity-of-care decision.
- `c4-component.md`: Consultations and Records move to done.
- Regenerate the data model page and the OpenAPI client, and mark consultations and records as
  done in `docs/index.md`.
