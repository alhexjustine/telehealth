# C4 L3 — Component (Backend API)

Components inside the Backend API container. Foundation, `add-authentication`, and
`add-doctor-availability` components are done; the remaining feature modules are planned and will
move to "done" as the change that implements them lands.

```mermaid
C4Component
  title Component diagram — Backend API

  Container_Boundary(api, "Backend API (NestJS)") {
    Component(config, "Config", "@nestjs/config + zod", "Validates environment at boot; done")
    Component(logging, "Logging", "nestjs-pino", "Structured logs with request IDs, password/cookie redaction; done")
    Component(errors, "Error Filter", "Nest exception filter", "Consistent JSON error responses; done")
    Component(prisma, "Prisma Service", "Prisma + pg driver adapter", "Lazy-connecting database access; done")
    Component(health, "Health", "@nestjs/terminus", "GET /api/health; done")
    Component(swagger, "Swagger", "@nestjs/swagger", "OpenAPI document + UI; done")
    Component(auth, "Auth", "SessionAuthGuard, RolesGuard, argon2, rate limiting", "Accounts, sessions, sign-in/out, deny-by-default access control; done")
    Component(users, "Users", "Prisma model + admin provisioning script", "Accounts and their status; the pre-provisioned administrator; done")
    Component(patients, "Patients", "PatientsController/Service", "Self-service patient profile and completeness; done")
    Component(doctors, "Doctors", "DoctorsController/Service", "Self-service doctor profile and specializations; done")
    Component(specializations, "Specializations", "SpecializationsController/Service", "Public, read-only catalog; done")
    Component(matching, "Doctor Matching", "planned", "Deterministic specialty matching; later change")
    Component(availability, "Availability", "AvailabilityController/SlotsController/Service", "Weekly schedule, time off, slot calculation; done")
    Component(booking, "Booking", "planned", "Book, reschedule, cancel; later change")
    Component(consult, "Consultations", "planned", "Session workspace, notes; later change")
    Component(notifications, "Notifications", "planned", "In-app, DB-backed; later change")
    Component(admin, "Admin Console", "planned", "User/doctor/appointment oversight, audit log; later change")
  }

  ContainerDb(db, "PostgreSQL")

  Rel(prisma, db, "SQL")
  Rel(auth, prisma, "uses")
  Rel(users, prisma, "uses")
  Rel(patients, prisma, "uses")
  Rel(doctors, prisma, "uses")
  Rel(specializations, prisma, "uses")
  Rel(patients, auth, "protected by")
  Rel(doctors, auth, "protected by")
  Rel(doctors, specializations, "references")
  Rel(matching, prisma, "uses")
  Rel(availability, prisma, "uses")
  Rel(availability, auth, "protected by")
  Rel(booking, prisma, "uses")
  Rel(booking, availability, "extends slot calculation")
  Rel(consult, prisma, "uses")
  Rel(notifications, prisma, "uses")
  Rel(admin, prisma, "uses")
```

See [Authentication & Authorization](/architecture/auth) for the Auth component's guard
pipeline, and [Data Model](/architecture/data-model) for the full schema.
