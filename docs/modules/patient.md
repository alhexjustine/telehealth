# Patient

> Accounts, sign-in/out, and profile are done (`add-authentication`). Doctor discovery and
> guided matching, booking/reschedule/cancel, in-app notifications, the consultation workspace,
> and the medical records/prescriptions view are planned for later changes.

## Module Overview

A visitor registers as a patient with an email, password, and name; the account is signed in
immediately (server-side session, `httpOnly` cookie — see
[Authentication & Authorization](/architecture/auth)). The patient area has its own navigation,
an initials avatar, and sign-out (this device or all devices). Patients view and edit their own
profile — name, birthday, weight, height, phone, emergency contact, and basic medical history —
and the patient home page prompts them to finish it until the required fields (name, birthday,
weight, height, phone) are all set.

## L2 Container View

Reuses the [C4 L2 Container](/architecture/c4-container) diagram's `web` and `api` containers —
no new container is introduced. The flows this slice adds:

```mermaid
flowchart LR
  P((Patient)) -->|"register / sign in / sign out"| W[Web: Patient area]
  P -->|"view / edit profile"| W
  W -->|"REST/JSON, session cookie"| A["API: Auth, Patients"]
  A -->|"SQL"| D[(PostgreSQL)]
```

## Data Model

The patient-owned slice of the full [Data Model](/architecture/data-model):

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
  users ||--o| patient_profiles : "user"
```

Profile completeness (name, birthday, weight, height, phone all set) is computed on read, not
stored — see [Authentication & Authorization](/architecture/auth) for the account/session model
this all sits behind.
