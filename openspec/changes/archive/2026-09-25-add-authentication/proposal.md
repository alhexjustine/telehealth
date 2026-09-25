# Proposal

## Why

Every step of the core journey after the landing page depends on knowing who the user is and
what role they have: patients book, doctors manage schedules, and admins oversee everything.
Nothing role-specific can be built until accounts, sessions, access control, and the patient and
doctor profiles exist. Doctor registration also needs the list of specializations that the later
discovery and matching changes will build on.

## What Changes

- Email/password registration for patients and doctors, sign-in, sign-out (this device or all
  devices), password change, and a "current user" endpoint.
- Server-side sessions in httpOnly cookies, with account status checked on every request so a
  suspended or deactivated account loses access immediately.
- Deny-by-default access control in the API: every endpoint requires a signed-in user unless
  explicitly marked public, and role restrictions (patient / doctor / admin) are enforced in the
  API.
- Protections: rate limiting on sign-in and registration, rejection of state-changing requests
  from foreign origins, generic sign-in errors, and hashed passwords and session tokens.
- A pre-provisioned administrator account created from configuration at startup. There is no
  public admin registration.
- Patient profile: name, birthday, weight, height, contact details, emergency contact, and basic
  medical history (conditions, allergies, current medications), with a clear "profile complete"
  state.
- Doctor profile: name, specializations, biography, years of experience, fictional license
  number, and consultation length. New doctors start in the "pending verification" state; the
  admin review itself arrives in `add-admin-console`.
- A public catalog of specializations, shipped as reference data.
- Web: sign-in and registration pages, and a separate area for each role (patient, doctor, admin)
  with its own navigation, initials avatar, sign-out, and redirects for signed-out users and for
  users in the wrong role. Profile pages for patients and doctors.
- Shared API bootstrap so the running app, the tests, and OpenAPI generation apply identical
  middleware, validation, and security settings.
- Documentation: authentication and authorization architecture page, L3 components, and the
  Patient, Doctor, and Admin module pages (overview, L2 view, data model) for this slice.

No external SaaS, BaaS, or runtime API is introduced. New dependencies are open-source libraries
(password hashing, rate limiting, cookie parsing, form handling).

**Product modules affected:** Patient, Doctor, Admin (accounts, profiles, role areas). Product
Website gains sign-in and registration entry links only; the landing page itself comes in
`add-product-website`.

## Capabilities

### New Capabilities
- `auth`: Account registration, sign-in and sign-out, sessions, password change, account status
  enforcement, role-based access control, the pre-provisioned administrator, and the role-based
  areas of the web app.
- `patient-profile`: A patient viewing and maintaining their own profile and basic medical
  history, and the profile-completeness rule later changes depend on.
- `doctor-profile`: A doctor viewing and maintaining their professional profile, its
  specializations, and its verification status.
- `specializations`: The public catalog of medical specializations used by doctor profiles and,
  later, discovery and matching.

### Modified Capabilities
<!-- None. local-deployment and technical-documentation requirements are unchanged; this change
     only adds pages and configuration settings within them. -->

## Impact

- API: new `auth`, `users`, `patients`, `doctors`, `specializations` modules; a global auth guard
  (existing `GET /api/health` and `/api/docs` become explicitly public); global request
  validation; new endpoints under `/api/auth`, `/api/patients/me`, `/api/doctors/me`,
  `/api/specializations`.
- Database: new tables for users, sessions, patient profiles, doctor profiles, specializations,
  and the doctor–specialization link, plus a data migration inserting the specialization catalog.
- Configuration: new settings for the admin account, allowed origins, cookie security, and
  session lifetime, all with working local defaults so `docker compose up --build` still needs no
  `.env`.
- Container startup: the API entrypoint provisions the admin account after migrations.
- Web: new routes, auth state, route guards, forms, and shadcn/ui components.
- Generated API client regenerated; docs pages updated.
