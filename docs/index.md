# Technical Overview

## Context

Telehealth is a fictional-prototype telehealth web application: a public product website plus
Patient, Doctor, and Admin experiences. It runs as a standalone stack — a React SPA, a NestJS
REST API, and PostgreSQL — with no external SaaS/BaaS/runtime dependencies. Everything a real
telehealth product would delegate to third parties (auth, doctor matching, notifications,
scheduling, consultations, medical records) is implemented in this stack instead.

See the [C4 Context diagram](/architecture/c4-context) for the actors and system boundary, and
the [Deployment page](/architecture/deployment) for how it runs locally.

## Features

| Feature                                            | Status  | Change               |
| -------------------------------------------------- | ------- | -------------------- |
| Local Docker Compose stack, health, error handling | Done    | `setup-foundation`   |
| Generated OpenAPI client                           | Done    | `setup-foundation`   |
| Patient/doctor accounts, sessions, sign-in/out     | Done    | `add-authentication` |
| Pre-provisioned administrator                      | Done    | `add-authentication` |
| Role-based access control                          | Done    | `add-authentication` |
| Patient profile & completeness                     | Done    | `add-authentication` |
| Doctor profile & verification status               | Done    | `add-authentication` |
| Specialization catalog                             | Done    | `add-authentication` |
| Doctor availability (schedule, time off, slots)     | Done    | `add-doctor-availability` |
| Doctor discovery (search, profile, slots)          | Done    | `add-doctor-discovery` |
| Guided symptom matching                            | Done    | `add-doctor-discovery` |
| Booking, reschedule, cancel                        | Done    | `add-appointment-booking` |
| Database-enforced double-booking prevention        | Done    | `add-appointment-booking` |
| In-app notifications (booking, reschedule, cancel) | Done    | `add-notifications`  |
| Upcoming-appointment reminders (24h/1h)             | Done    | `add-notifications`  |
| Live delivery (socket.io) + notification bell/page | Done    | `add-notifications`  |
| Consultation workspace                             | Planned | a later change       |
| Notes & prescriptions                              | Planned | a later change       |
| Admin user/doctor/appointment oversight            | Planned | a later change       |
| Product website (landing, disclaimers)             | Planned | a later change       |
