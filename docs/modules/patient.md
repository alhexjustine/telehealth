# Patient

> Accounts, sign-in/out, profile, doctor discovery, and guided symptom matching are done
> (`add-authentication`, `add-doctor-availability`, `add-doctor-discovery`). Booking/reschedule/
> cancel, in-app notifications, the consultation workspace, and the medical records/prescriptions
> view are planned for later changes.

## Module Overview

A visitor registers as a patient with an email, password, and name; the account is signed in
immediately (server-side session, `httpOnly` cookie — see
[Authentication & Authorization](/architecture/auth)). The patient area has its own navigation,
an initials avatar, and sign-out (this device or all devices). Patients view and edit their own
profile — name, birthday, weight, height, phone, emergency contact, and basic medical history —
and the patient home page prompts them to finish it until the required fields (name, birthday,
weight, height, phone) are all set.

Once signed in, a patient finds a doctor one of two ways:

- **Find a doctor** — a search over approved, active doctors by name or specialization, with a
  specialization filter, an "available between" filter (today / next 3, 7, or 14 days / any), and
  sorting by soonest availability, name, or years of experience. Each result shows the doctor's
  next available slot within 14 days. Opening a doctor shows their full profile and a 14-day slot
  picker, grouped by date and shown in the patient's own time zone.
- **Find care** — guided matching. The patient picks symptoms from a categorized catalog and/or
  describes them in free text; the API scores specializations and ranks doctors with a
  deterministic, explainable algorithm (no external AI). A red-flag symptom shows an emergency
  banner first and hides the doctor list until the patient acknowledges it.

Both paths only ever surface doctors who are `APPROVED` and whose account is `ACTIVE` — the same
visibility rule the slots endpoint already used, now shared by search, the profile view, and
matching (`visibleDoctorWhere`/`isVisibleDoctor` in `apps/api/src/doctors/doctor-visibility.ts`).

## L2 Container View

Reuses the [C4 L2 Container](/architecture/c4-container) diagram's `web` and `api` containers —
no new container is introduced. The flows this slice adds:

```mermaid
flowchart LR
  P((Patient)) -->|"register / sign in / sign out"| W[Web: Patient area]
  P -->|"view / edit profile"| W
  P -->|"search, filter, sort doctors"| W
  P -->|"view profile + 14-day slots"| W
  P -->|"pick symptoms / describe"| W
  W -->|"REST/JSON, session cookie"| A["API: Auth, Patients, Discovery, Matching"]
  A -->|"SQL"| D[(PostgreSQL)]
```

## Data Model

The patient-owned slice of the full [Data Model](/architecture/data-model), plus the read-only
symptom catalog guided matching scores against:

```mermaid
erDiagram
  users {
    string id PK
    string email UK
    string role
    string status
  }
  patient_profiles {
    string user_id PK,FK
    string first_name
    string last_name
    datetime birth_date
    decimal weight_kg
    decimal height_cm
    string phone
  }
  symptoms {
    string id PK
    string slug UK
    string name
    string category
    string_array keywords
    boolean is_red_flag
  }
  symptom_specializations {
    string symptom_id PK,FK
    string specialization_id PK,FK
    int weight
  }
  specializations {
    string id PK
    string slug UK
    string name UK
  }
  users ||--o| patient_profiles : "user"
  symptoms ||--o{ symptom_specializations : "links to"
  specializations ||--o{ symptom_specializations : "linked from"
```

Profile completeness (name, birthday, weight, height, phone all set) is computed on read, not
stored — see [Authentication & Authorization](/architecture/auth) for the account/session model
this all sits behind. The symptom catalog is reference data shipped by a migration
(`20260925103000_add_symptom_catalog`), the same pattern as the specialization catalog: fixed
UUIDs, present in every environment without a separate seeding step, and read-only (nothing in the
app writes to it).

## Matching algorithm

`match()` in `apps/api/src/matching/matching-engine.ts` is a pure function — no database, no
clock — over the symptom catalog and a pre-fetched list of visible doctors (with their
specializations and next available slot, computed by the same `NextSlotService` search uses). The
API layer (`MatchingService`) loads that data, computes the patient's age from their profile's
birthday, and calls it.

1. Symptoms passed by ID are marked **selected**. The free-text description is normalized
   (lowercased, punctuation replaced with spaces, whitespace collapsed) and checked against every
   catalog symptom's keywords as whole words/phrases; matches are marked **described**. A symptom
   counts once even if it's both selected and described.
2. Each specialization's score is the sum of its weights to every matched symptom.
3. If the patient is under 18, Pediatrics is boosted to 4 above the current highest score (not
   summed with any score it already had from a matched symptom — the higher of the two wins).
4. If nothing matched, General Practice gets a score of 1 with a "no specific match" reason.
5. The top three specializations, by score then name, are returned with their reasons (each a
   symptom → specialization pair, or an age/default reason with no symptom).
6. Doctors are approved, active doctors with at least one of those three specializations, ranked
   by their best matching specialization's score, then soonest next available slot within 14 days
   (no slot sorts last), then name — at most 10.

Any matched symptom marked a red flag makes the response `urgent`, with a message naming the
red-flag symptoms; specializations and doctors are still returned so the patient isn't stuck on a
warning with nowhere to go. Nothing about the request is persisted — booking (a later change)
decides whether to carry the selected symptoms forward via the URL.

### Worked example: Headache + Cough

An adult patient selects **Headache** (Neurology 3, General Practice 1) and **Cough**
(Pulmonology 2, General Practice 2):

| Specialization    | Score | Why                                  |
| ------------------ | ----- | ------------------------------------- |
| General Practice   | 3     | Headache (1) + Cough (2)              |
| Neurology           | 3     | Headache (3)                          |
| Pulmonology         | 2     | Cough (2)                             |

General Practice and Neurology tie at 3; ties break by name, so General Practice ranks first,
then Neurology, then Pulmonology. Doctors are then drawn from those three specializations, ranked
by their own best-matching score and soonest slot.
