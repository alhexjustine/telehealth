# Proposal

## Why

Patients and doctors need to know when something changes: a new booking, a cancellation, a
reschedule, or an appointment that is about to start. The brief requires database-backed in-app
notifications for bookings, upcoming appointments, cancellations, and schedule changes, without
email, SMS, or push services. Live delivery also sets up the real-time channel that the
consultation workspace will use next.

## What Changes

- Notifications are stored in PostgreSQL, one per recipient. Each has a type, title, body,
  structured data (for example appointment times), a link, and a read state.
- Appointment events create notifications in the same transaction as the event:
  - A booking notifies the doctor and confirms to the patient.
  - A reschedule notifies the doctor and confirms to the patient.
  - A cancellation notifies the other participant.
- A scheduled job in the API creates reminders 24 hours and 1 hour before each booked
  appointment, for both participants. Reminders are never duplicated, are skipped for cancelled
  appointments, and are skipped when the booking was made inside that window.
- Endpoints to list your notifications, get the unread count, mark one read, and mark all read.
- Live delivery over a self-hosted socket.io gateway, authenticated with the existing session
  cookie. Each user receives only their own events, and sockets are disconnected when their
  session ends. The web falls back to periodic refresh when the socket is unavailable.
- Web: a notification bell with an unread badge and a recent-items dropdown in every role layout,
  a notifications page, and a toast when a new notification arrives live.
- Documentation: notifications and real-time architecture (a sequence diagram from event to
  commit to delivery), the module pages, L3 components, and the regenerated data model.

No external SaaS, BaaS, push, email, or SMS service is introduced. The new dependencies are
open-source: `@nestjs/schedule`, `@nestjs/websockets`, `@nestjs/platform-socket.io`, and
`socket.io-client`.

**Product modules affected:** Patient and Doctor (notifications, reminders, live updates). Admin
gets the bell and page; admin-relevant events come in `add-admin-console`.

## Capabilities

### New Capabilities
- `notifications`: Which events notify whom, the upcoming-appointment reminders, reading and
  marking notifications, live delivery and its authentication, and the web bell and page.

### Modified Capabilities
<!-- None. The appointments requirements are unchanged; notifications observe them. -->

## Impact

- API: a new `notifications` module and a `realtime` gateway. The appointment service's book,
  reschedule, and cancel transactions create notifications and publish them after commit. The
  session service disconnects sockets when sessions are revoked.
- Database: a new `notifications` table with a unique deduplication key.
- Configuration: `REMINDERS_ENABLED` (default `true`; `false` in tests and OpenAPI generation).
- Web: the bell, the notifications pages, the socket client, and the query invalidation it
  triggers.
- The generated API client and the docs are regenerated.
