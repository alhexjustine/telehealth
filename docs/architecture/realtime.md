# Notifications & Real-time

Database-backed in-app notifications for appointment events and upcoming-appointment reminders,
delivered live over a self-hosted socket.io gateway — `add-notifications`. No external
notification/push/email/SMS service is used anywhere in this path.

## Notification model

One row per recipient, written by `NotificationsService.stage` inside the same transaction as the
event that caused it, and only published over the socket after that transaction commits:

```mermaid
sequenceDiagram
  participant Patient as Patient (browser)
  participant API as NestJS API
  participant DB as PostgreSQL
  participant Gateway as Realtime Gateway
  participant Doctor as Doctor (browser)

  Patient->>API: POST /api/appointments (book)
  API->>DB: BEGIN
  API->>DB: assertBookable + INSERT appointment
  API->>DB: INSERT notification (doctor, APPOINTMENT_BOOKED)
  API->>DB: INSERT notification (patient, BOOKING_CONFIRMED)
  API->>DB: COMMIT
  API-->>Patient: 201 {appointment}
  API->>Gateway: publish(notifications)
  Gateway->>Doctor: notification:new {notification, unreadCount} (room user:{doctorId})
  Gateway->>Patient: notification:new {notification, unreadCount} (room user:{patientId})
```

If the transaction throws (a business-rule rejection, a race lost to another booking, ...),
nothing is published and no notification row survives — publishing is only ever reached after
`$transaction` resolves. `withNotifications(prisma, notificationsService, fn)` is the shared
helper `AppointmentsService.book/reschedule/cancel` use for this; see
`apps/api/src/notifications/with-notifications.ts`.

Reminders (24h and 1h before a `BOOKED` appointment's start) come from `ReminderService.run(now)`,
on a `@nestjs/schedule` `@Cron('*/1 * * * *')` when `REMINDERS_ENABLED` is on (it's off in tests,
CI, and OpenAPI generation, so no timer keeps those processes alive). A unique `dedupeKey`
(`reminder:{24h|1h}:{appointmentId}:{userId}`) makes re-running the cron idempotent.

## The realtime gateway

`RealtimeGateway` is a plain socket.io `Server` (`@nestjs/websockets` + `@nestjs/platform-socket.io`'s
`IoAdapter`) attached to the same NestJS HTTP server, at `path: '/socket.io'` — outside the `/api`
prefix, which nginx and the Vite dev proxy already forward with the WebSocket upgrade (see
[Deployment](/architecture/deployment)).

**Handshake**, run for every connection before it joins any room:

1. Parse the `th_session` cookie from the raw `Cookie` handshake header (the socket.io handshake
   never goes through Express's `cookie-parser`).
2. Check the `Origin` header against `APP_ORIGINS`, when present.
3. Validate the session through `SessionService.validateSession` — the exact same method
   `SessionAuthGuard` uses for HTTP requests, including the account-status check.
4. On any failure, `socket.disconnect(true)` before the socket joins anything.

On success the socket joins two rooms: `user:{userId}` (where events fan out) and
`session:{sessionId}` (so one revoked session's sockets can be disconnected without touching the
same user's other, still-valid sessions/devices). The socket re-validates its session every 5
minutes and disconnects itself if it's no longer valid, covering natural expiry between requests.

**Revocation.** `SessionService.revokeSession` / `revokeAllSessions` / `revokeAllSessionsExcept`
all call `disconnectSessions(sessionIds)` after revoking in the database — covering logout,
logout-all, and password change (which revokes every other session) today, and admin suspension
once `add-admin-console` lands. `SessionService` depends on this through a
`SESSION_REALTIME_NOTIFIER` token/interface rather than importing `RealtimeGateway` directly: the
two modules depend on each other (`AuthModule` ⇄ `RealtimeModule`, both behind `forwardRef`), and a
class used directly as a constructor parameter's type in that cycle throws
`Cannot access '<Class>' before initialization` the moment either file evaluates first, even
behind `forwardRef` — see `apps/api/src/auth/session/session-realtime-notifier.ts`.

**Events:**

| Event                | Payload                                | When |
| --------------------- | --------------------------------------- | ---- |
| `notification:new`    | `{ notification, unreadCount }`         | After an event's transaction commits, to each recipient's `user:{id}` room |
| `notifications:count` | `{ unreadCount }`                       | After mark-read / mark-all-read, so every open tab stays in sync |

There is a single API instance and no Redis adapter — acceptable at this scale (see design.md's
"Risks / Trade-offs"). `RealtimeGateway` also exposes `joinRoom`/`emitToRoom` helpers for
`add-consultations-and-records` to reuse the same connection for consultation state.

## Web

`RealtimeProvider` (mounted once, inside `RoleAreaLayout`, so every role gets it) opens a single
`socket.io-client` connection with `withCredentials: true` and no explicit URL (same-origin, like
every other API call). On `notification:new` it updates the unread-count query's cached data,
invalidates the notifications list and appointment queries, and shows a toast; on
`notifications:count` it just updates the count.

The unread-count query (`useUnreadCount`) sets `refetchInterval: 60_000` only while
`useRealtimeConnected()` is false — the fallback the "Fallback without a live connection" scenario
requires. The `NotificationBell` in every role header shows the badge and a dropdown of the 10
most recent notifications with "mark all as read"; opening one marks it read and navigates to its
(already role-relative) `link`. Each role area also has a `/{role}/notifications` page with an
unread filter and pagination.

## Reading API

| Method | Path                        | Access        |
| ------ | ---------------------------- | ------------- |
| GET    | `/notifications`             | signed in (own) |
| GET    | `/notifications/unread-count`| signed in (own) |
| POST   | `/notifications/{id}/read`   | signed in (own) → 200 / 404 |
| POST   | `/notifications/read-all`    | signed in (own) → 204 |

Every query and mutation is scoped to `request.user.id`; there's no way to read or change another
user's notifications (`404`, not `403`, for someone else's notification ID — the standard
"don't confirm it exists" pattern used elsewhere in this API).
