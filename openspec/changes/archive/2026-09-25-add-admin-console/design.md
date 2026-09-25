# Design

## Context

This change builds on all previous changes:
- **Accounts and sessions:** `User.status` and `statusReason`, and the session service's
  revoke-all, which also disconnects sockets.
- **Doctors:** `DoctorProfile.verificationStatus` and `reviewNote`, the doctor self-profile
  update, and the visible-doctor helper.
- **Appointments:** the appointments service's cancel logic (`cancelledById`, reason, freeing
  slots), and `AppointmentStatus`, which gains `NOT_HELD` here. Also the consultation session
  state, and `withNotifications` with `NotificationType`, which gains values here.
- **Plumbing:** `DomainError` codes, request IDs, and the `trust proxy` client IP.
- **Web:** the admin role layout, with a placeholder home.

If implemented names differ, adapt to the real code and keep the behavior in the specs.

## Goals / Non-Goals

**Goals:**
- One way to write audit entries, which can only be called with a transaction client, so an
  audited action and its entry commit or roll back together.
- Admin actions reuse the domain services (cancel, status revoke, profile validation) rather than
  reimplementing them.

**Non-Goals:**
- Multiple admin roles or permissions, and admin account management (the admin account is
  pre-provisioned only).
- Bulk actions and CSV export.
- Admin access to clinical content, which is explicitly forbidden.
- Editing the specialization or symptom catalogs; both stay read-only reference data.

## Decisions

### Audit log model and immutability
```
enum AuditAction { USER_STATUS_CHANGED DOCTOR_APPROVED DOCTOR_REJECTED DOCTOR_PROFILE_UPDATED
                   APPOINTMENT_CANCELLED APPOINTMENT_MARKED_NOT_HELD ADMIN_SIGNED_IN }
AuditLog  id uuid, actorId → User, action, entityType varchar(40), entityId uuid?, reason?,
          before jsonb?, after jsonb?, requestId, ip, userAgent?, createdAt
          @@index([createdAt(sort: Desc)]) @@index([entityType, entityId]) @@index([actorId])
```
The migration adds a trigger:

```
CREATE FUNCTION audit_logs_immutable() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'audit_logs is append-only'; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER audit_logs_no_update_delete BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_immutable();
```

`TRUNCATE` is not a row event, so the e2e truncation helper keeps working. That limitation is
documented. The actor foreign key is `ON DELETE RESTRICT`; users are never hard-deleted.
*Rejected:* a separate audit database or hash chaining. Both are overkill for a prototype; the
append-only trigger plus no API mutation routes meets the spec.

### Audit writer
`AuditService.record(tx: Prisma.TransactionClient, entry)` takes a transaction client, so calling
it outside a transaction is a type error. It reads `requestId`, `ip`, and `userAgent` from a
request-scoped context: an `AsyncLocalStorage` set by the existing request-ID middleware, which
also captures `req.ip`.

`before` and `after` contain only the changed fields, via a `diffFields(before, after, allowList)`
helper whose allow-list excludes secrets and clinical fields.

The admin sign-in entry is written by the auth service in the sign-in transaction when
`role = ADMIN`.

### Status changes reuse domain services
`AdminUsersService.changeStatus(adminId, userId, status, reason)` runs in one transaction:
1. Lock the user row.
2. Reject admin targets (403) and unchanged status (`STATUS_UNCHANGED`).
3. Update the status and reason.
4. If the new status is not `ACTIVE`: revoke all sessions (the socket disconnect happens after
   commit).
5. If `DEACTIVATED`: for each upcoming `BOOKED` appointment, call the shared
   `AppointmentsService.cancelInTx(tx, appt, { cancelledById: adminId, reason: 'Account deactivated: ' + reason, kind: 'deactivation' })`.
6. Stage notifications: for deactivation, the counterpart only.
7. Record the audit entry, with `after.cancelledAppointmentIds`.

Extract `cancelInTx` from the existing cancel path if it isn't already shared. The patient,
doctor, and admin cancel paths must all go through it.

### Doctor review
`GET /admin/doctors?verification=PENDING&page` lists oldest `createdAt` first (use the profile
`updatedAt`, since a re-review resets it). Approve and reject run in one transaction:
1. Check `STATUS_UNCHANGED`.
2. Update the status and note.
3. Stage the doctor notification (`PROFILE_APPROVED` or `PROFILE_REJECTED`).
4. Record the audit entry.

The admin profile edit reuses the doctor profile DTO and validation (a shared class or
function), minus the re-review rule, and audits the changed fields.

The re-review rule in the doctor's self-update compares the license and the set of specialization
IDs. If either changed and the doctor was `APPROVED`, it sets `PENDING` and clears `reviewNote`.
The response and the doctor home page show the pending notice from the auth change.

### Invalid-booking flags
These are computed at query time with SQL conditions:
- `NOT_COMPLETED`: `status = BOOKED AND ends_at < now() - interval '30 minutes'`
- `DOCTOR_UNAVAILABLE`: `status = BOOKED AND starts_at > now()`, and the doctor is not approved
  or the doctor's user is not active

Both are exposed as `flags[]` on each list item, plus an `invalidOnly` filter. The same
conditions feed the dashboard count; put them in one query-builder module.
*Rejected:* storing flags, which would need a job to keep them correct.

### Not held
The migration adds `NOT_HELD` to `AppointmentStatus`.
`POST /admin/appointments/{id}/mark-not-held { reason }`:
1. Check that the `NOT_COMPLETED` condition holds, else `NOT_ELIGIBLE_FOR_NOT_HELD`.
2. Set the status, and store the reason in `cancellationReason` (rename to `statusReason` only if
   trivial; otherwise add `resolutionReason`).
3. Record the audit entry.

Patient and doctor past lists already include non-`BOOKED` statuses. Add the badge in the web.

### Dashboard queries
`GET /admin/dashboard?tz=Asia/Manila` is validated like availability time zones. It uses:
- `groupBy` counts for users, doctors, appointments, and sessions
- a single SQL query for the daily buckets:
  `date_trunc('day', starts_at AT TIME ZONE $tz)` over `[today − 14d, today + 14d]` with
  `status IN ('BOOKED','COMPLETED')`
- the invalid and pending counts from the shared builders

Everything is computed per request, with no caching.

### API surface (all `@Roles(ADMIN)`)
| Method | Path |
|---|---|
| GET | `/admin/users` |
| POST | `/admin/users/{id}/status` |
| GET | `/admin/doctors`, `/admin/doctors/{id}` |
| PATCH | `/admin/doctors/{id}` |
| POST | `/admin/doctors/{id}/approve`, `/admin/doctors/{id}/reject` |
| GET | `/admin/appointments`, `/admin/appointments/{id}` |
| POST | `/admin/appointments/{id}/cancel`, `/admin/appointments/{id}/mark-not-held` |
| GET | `/admin/dashboard` |
| GET | `/admin/audit`, `/admin/audit/{id}` |

The admin appointment DTOs are built from an explicit allow-list: times, participant names and
IDs, status, session state, flags, and cancellation metadata. There is a test that the
serialized payload contains no clinical keys.

### Web
- **`/admin` dashboard:** stat tiles, with the pending-review and invalid-booking tiles linking
  to the filtered pages. The chart is a plain SVG bar chart of 29 buckets, with a marker on
  today and accessible labels (`<title>` per bar, plus a visually hidden table). Colors come from
  the theme tokens. No chart library.
- **`/admin/users`:** a URL-synced search and filters table. The status dialog has a required
  reason and a deactivation warning showing the upcoming count from the list item.
- **`/admin/doctors`:** tabs for pending, approved, and rejected.
- **`/admin/doctors/:doctorId`:** the profile, an edit form reusing the doctor profile form
  component in admin mode, approve (optional note) and reject (required note) dialogs, and a
  link to the audit entries.
- **`/admin/appointments`:** a filters table with flag badges, cancel and mark-not-held dialogs,
  and a link to the audit entries.
- **`/admin/audit`:** a filters table. The entry detail sheet shows a before and after diff
  table.
- Admin navigation: Dashboard, Users, Doctor reviews, Appointments, Audit log.

### Testing approach
- **Unit:** `diffFields` (the allow-list excludes secrets), the re-review rule, the flag
  builders, and the dashboard bucket time-zone math.
- **e2e:** every scenario in all five admin specs, plus the modified doctor-profile and
  notification scenarios. This includes:
  - the database trigger (a raw UPDATE or DELETE on `audit_logs` fails)
  - the "no clinical content" payload check
  - atomicity: a forced failure after the audit write rolls back both
- **Web:** the deactivation warning, approve moving between tabs, the invalid-only view, a tile
  link, and the diff view.

## Risks / Trade-offs

- [Deactivation mass-cancels appointments] → The warning dialog shows the count, a reason is
  required, the counterparts are notified, and the audit entry lists every cancelled ID.
- [The re-review rule hides a doctor mid-week while they still have bookings] → Their
  appointments are kept and flagged `DOCTOR_UNAVAILABLE` for the admin to decide, and the doctor
  sees the pending notice.
- [`TRUNCATE` bypasses the immutability trigger] → The application never truncates. Only the
  test helper does, and this is documented.
- [Query-time flags and counts on every request] → Fine at prototype scale, with indexes on
  status and `starts_at`.

## Migration Plan

Additive: a new table, trigger, and function, plus new enum values (`NOT_HELD`, the audit
actions, and the notification types). Adding enum values in PostgreSQL is non-transactional in
older versions, but fine in PostgreSQL 17.

## Documentation impact

- `docs/modules/admin.md`: a full module overview, the L2 view, the data model (`audit_logs`
  plus the fields admins act on), the admin permission matrix, the invalid-booking rules, and the
  audit design (transactional writer, immutability trigger, and what is never logged).
- `c4-component.md`: Admin and Audit move to done.
- `docs/architecture/auth.md`: the admin sign-in audit, and suspension revoking sessions and
  sockets.
- Regenerate the data model page and the OpenAPI client, and mark the admin features as done in
  `docs/index.md`.
