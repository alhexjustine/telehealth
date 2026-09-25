# C4 L3 — Component (Backend API)

Components inside the Backend API container. Foundation components exist now; feature modules
are planned and will move to "done" as the change that implements them lands.

```mermaid
C4Component
  title Component diagram — Backend API

  Container_Boundary(api, "Backend API (NestJS)") {
    Component(config, "Config", "@nestjs/config + zod", "Validates environment at boot; done")
    Component(logging, "Logging", "nestjs-pino", "Structured logs with request IDs; done")
    Component(errors, "Error Filter", "Nest exception filter", "Consistent JSON error responses; done")
    Component(prisma, "Prisma Service", "Prisma + pg driver adapter", "Lazy-connecting database access; done")
    Component(health, "Health", "@nestjs/terminus", "GET /api/health; done")
    Component(swagger, "Swagger", "@nestjs/swagger", "OpenAPI document + UI; done")
    Component(auth, "Auth", "planned", "Email/password auth, sessions; add-authentication")
    Component(matching, "Doctor Matching", "planned", "Deterministic specialty matching; later change")
    Component(scheduling, "Scheduling", "planned", "Booking, reschedule, cancel; later change")
    Component(consult, "Consultations", "planned", "Session workspace, notes; later change")
    Component(notifications, "Notifications", "planned", "In-app, DB-backed; later change")
    Component(admin, "Admin", "planned", "User/appointment oversight, audit log; later change")
  }

  ContainerDb(db, "PostgreSQL")

  Rel(prisma, db, "SQL")
  Rel(auth, prisma, "uses")
  Rel(matching, prisma, "uses")
  Rel(scheduling, prisma, "uses")
  Rel(consult, prisma, "uses")
  Rel(notifications, prisma, "uses")
  Rel(admin, prisma, "uses")
```
