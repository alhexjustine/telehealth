# C4 L2 — Container

```mermaid
C4Container
  title Container diagram — Telehealth

  Person(patient, "Patient")
  Person(doctor, "Doctor")
  Person(admin, "Administrator")

  System_Boundary(system, "Telehealth (runtime-owned containers only)") {
    Container(web, "Web Application", "React + Vite, served by nginx", "Product website, Patient, Doctor, and Admin UIs")
    Container(api, "Backend API", "NestJS + Prisma", "REST/JSON and WebSocket for live updates")
    ContainerDb(db, "Database", "PostgreSQL", "Users, appointments, consultations, medical records")
  }

  Rel(patient, web, "Uses", "HTTPS")
  Rel(doctor, web, "Uses", "HTTPS")
  Rel(admin, web, "Uses", "HTTPS")
  Rel(web, api, "Calls", "REST/JSON, WebSocket")
  Rel(api, db, "Reads/writes", "SQL")
```

This matches the brief's Figure 1: Web Application → REST/JSON → Backend API (NestJS + Prisma) →
PostgreSQL, all inside one runtime-owned boundary, plus the WebSocket edge nginx and the Vite dev
proxy forward to the self-hosted socket.io gateway (`add-notifications`) for live notification
delivery — see [Notifications & Real-time](/architecture/realtime) and
[C4 L3 — Component](/architecture/c4-component). No third-party system is shown or depended on.
