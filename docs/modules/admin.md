# Admin

> Planned — not implemented yet. Pre-provisioned sign-in, user management (activate/suspend/
> deactivate with stored reasons), doctor profile review/approval, appointment oversight, an
> operational dashboard, and an audit log of admin actions will be completed by later changes,
> starting with `add-authentication`.

## Module Overview

Planned. Admins share the same underlying tables as Patient and Doctor (users, appointments,
consultations) and differ by permission scope, not by separate databases — role-based access
control is enforced in NestJS, not just hidden in the UI.

## L2 Container View

Planned. Will reuse the [C4 L2 Container](/architecture/c4-container) diagram's `web` and `api`
containers — no new container is introduced.

## Data Model

Planned.
