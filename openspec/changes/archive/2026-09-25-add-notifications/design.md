# Design

## Context

This change builds on:
- **`add-authentication`:** opaque sessions validated by hashing the `th_session` cookie, the
  session service with revoke-one / revoke-all / revoke-all-but-current, `APP_ORIGINS`, and
  role layouts in the web app.
- **`add-appointment-booking`:** book, reschedule, and cancel run inside Prisma transactions in
  the appointments service; also `DomainError` codes.
- **`setup-foundation`:** nginx and the Vite dev proxy already forward `/socket.io/` with
  WebSocket upgrade.

If the earlier changes' names differ once implemented, adapt to the real code and keep the
behavior in the specs. The requirements are in `specs/notifications`.

## Goals / Non-Goals

**Goals:**
- A notification-writing API that feature services call inside their own transaction, with
  delivery happening only after commit.
- A real-time gateway that `add-consultations-and-records` can reuse for consultation state,
  with rooms keyed by user and, later, by appointment.

**Non-Goals:**
- Notification preferences, muting, or retention and cleanup jobs.
- Admin-specific events (`add-admin-console` adds its types).
- Email, SMS, or browser push.
- Horizontal scaling of sockets. There is one API instance, and no Redis adapter.

## Decisions

### Notification model
```
enum NotificationType { APPOINTMENT_BOOKED BOOKING_CONFIRMED APPOINTMENT_RESCHEDULED
                        RESCHEDULE_CONFIRMED APPOINTMENT_CANCELLED REMINDER_24H REMINDER_1H }
Notification  id uuid, userId → User (cascade), type, title varchar(120), body varchar(500),
              data jsonb, link varchar(200), appointmentId? → Appointment (set null),
              dedupeKey? unique, readAt?, createdAt
              @@index([userId, createdAt(sort: Desc)]) @@index([userId, readAt])
```
`title` and `body` are stored as plain text without times, for example
"New booking with Maria Santos". `data` carries `startsAt`, `previousStartsAt`,
`counterpartName`, and `reason`, so the web can format times in the viewer's time zone.
Later changes add enum values in their own migrations.
*Rejected:* formatting times into the body on the server, because the server doesn't know each
viewer's time zone.

### Transactional write, post-commit publish
`NotificationsService.stage(tx, drafts[])` inserts the rows inside the caller's transaction and
returns them. Appointment services use a small helper:
```
const { result, notifications } = await withNotifications(prisma, async (tx, notify) => { ...; await notify(drafts); return appt; });
realtime.publish(notifications);   // only reached after commit
```
If the transaction throws, nothing is published and the rows roll back.
*Rejected:* `@nestjs/event-emitter` listeners writing after commit. They lose atomicity: the event
could succeed while its notification fails.
*Rejected:* a full outbox table with a relay. That is more machinery than one process needs.

### Recipient rules
These live in one `appointment-notifications.ts` that maps each event to its drafts:
- **Book:** doctor ← `APPOINTMENT_BOOKED`; patient ← `BOOKING_CONFIRMED`.
- **Reschedule:** doctor ← `APPOINTMENT_RESCHEDULED`; patient ← `RESCHEDULE_CONFIRMED`.
- **Cancel:** the counterpart of `cancelledById` ← `APPOINTMENT_CANCELLED`. A reschedule's
  internal cancel of the old appointment creates no cancel notification; the reschedule
  notifications cover it.

Links are role-relative: `/patient/appointments/{id}` or `/doctor/appointments/{id}`.

### Reminder job
`@nestjs/schedule` runs `@Cron('*/1 * * * *')` → `ReminderService.run(now)` when
`REMINDERS_ENABLED`. Running every minute keeps delivery well within the 5-minute bound and is
cheap: two indexed range queries.

For each window W in {24h, 1h}, select `BOOKED` appointments where:
- `startsAt > now`
- `startsAt - W <= now` (the window has begun)
- `createdAt <= startsAt - W` (booked before the window began)

Then `createMany({ skipDuplicates: true })` two drafts per appointment, with
`dedupeKey = reminder:{W}:{appointmentId}:{userId}`, and publish the rows actually created.
Because `createMany` doesn't return rows, re-select by the dedupe keys created in this run, or
insert per row catching unique violations.

`run(now)` is public so tests can call it with an injected clock.
*Rejected:* scheduling a timer per appointment. It would be lost on restart and need rebuilding.

### Real-time gateway
The gateway is `@WebSocketGateway({ path: '/socket.io', cors: false })` with socket.io. It sits
outside the `/api` prefix, which the existing proxies already expect.

Handshake:
1. Parse the `th_session` cookie from `socket.handshake.headers.cookie`.
2. Check `Origin` against `APP_ORIGINS`.
3. Validate the session through the same session service method as the HTTP guard, including
   the account-status check.
4. On failure, `socket.disconnect(true)` before joining any room.

On success, the socket joins `user:{userId}`, and `socket.data` holds `{ userId, sessionId }`.

Events:
- `notification:new` with `{ notification, unreadCount }`
- `notifications:count` with `{ unreadCount }`, sent after mark-read and mark-all

Revocation: the session service calls `realtime.disconnectSessions(sessionIds)` whenever it
revokes, which covers logout, logout-all, password change, and admin suspension later. Expiry:
the socket re-validates its session every 5 minutes and disconnects if it is invalid. The
gateway exposes `joinRoom` and `emitToRoom` helpers for the consultation workspace next.
*Rejected:* Server-Sent Events. They would work for notifications, but the consultation
workspace needs bidirectional state updates, and one transport is simpler.

### Unread count
`SELECT count(*) WHERE userId = ? AND readAt IS NULL`, using the index. It is returned by
`GET /notifications/unread-count` and pushed with every event.

### API surface
| Method | Path | Access |
|---|---|---|
| GET | `/notifications?unreadOnly=&page=&pageSize=` | signed in (own) |
| GET | `/notifications/unread-count` | signed in (own) |
| POST | `/notifications/{id}/read` | signed in (own) → 200 / 404 |
| POST | `/notifications/read-all` | signed in (own) → 204 |

### Web
- A `RealtimeProvider` inside the authenticated layouts connects `socket.io-client` to
  `path: '/socket.io'` with `withCredentials`. On `notification:new` it sets the unread-count
  query data, invalidates the notifications list and any appointment queries, and shows a toast.
  It disconnects on sign-out.
- The unread-count query uses `refetchInterval: 60_000`, active only while the socket is
  disconnected. That provides the fallback required by the spec.
- The `NotificationBell` sits in every role header: a badge (99+ cap), a dropdown with 10 items,
  "Mark all as read", and a "View all" link. Relative times use `date-fns` `formatDistanceToNow`,
  and appointment times are formatted in the viewer's time zone.
- The page is `/{role}/notifications`, with an "Unread only" toggle and pagination.
- The consultation workspace will reuse the provider's socket.

### Testing approach
- **Unit:** the recipient rules for each event, the reminder window selection (booked before the
  window, short notice, cancelled), and dedupe-key construction.
- **e2e:**
  - every notifications scenario
  - atomicity: force a rollback after staging, and assert that no rows remain
  - reminders, by calling `ReminderService.run(fakeNow)` directly with appointments inserted
    through the test database
  - the socket scenarios, using `socket.io-client` in Jest against the app listening on an
    ephemeral port, with the cookie from a signed-in agent: unauthenticated refused, only own
    events, disconnected after logout
- **Web:** the bell badge and dropdown, opening a notification (marks read and navigates), the
  empty state, and a toast on a mocked socket event.

## Risks / Trade-offs

- [The in-process cron runs once per API instance] → There is a single instance, and the dedupe
  keys make duplicate runs harmless anyway.
- [Sockets hold sessions open past revocation] → Revocation disconnects immediately, and the
  periodic re-validation covers expiry.
- [Enum growth needs migrations in later changes] → This is intended; it keeps types explicit.

## Migration Plan

Additive: one table, one enum.

## Documentation impact

- New section in `docs/architecture/c4-container.md`, or a new `docs/architecture/realtime.md`:
  the socket.io connection, the handshake authentication, rooms, and a sequence diagram of
  book → transaction (appointment + notifications) → commit → publish → browser.
- `docs/modules/patient.md` and `doctor.md`: the notifications overview and the table in the ER
  diagram.
- `c4-component.md`: Notifications and Realtime move to done.
- Regenerate the data model page and the OpenAPI client, and mark notifications as done in
  `docs/index.md`.
