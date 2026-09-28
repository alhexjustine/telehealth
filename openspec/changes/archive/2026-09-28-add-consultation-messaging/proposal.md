# Proposal

## Why

Once a patient books an appointment, the only way to reach their doctor (or vice versa) is
through the notification-triggering actions the system already models (booking, rescheduling,
cancelling) or the live consultation workspace during the join window. There is no way to ask a
quick question beforehand, follow up afterward, or clarify something about an upcoming visit —
every other production telehealth product treats asynchronous messaging as a baseline feature.
This bonus feature closes that gap with a first-party, appointment-scoped message thread, without
introducing any external chat/SaaS dependency.

## What Changes

- New `Message` data model and `apps/api/src/messages/` module: a patient and their doctor on a
  given appointment can exchange short text messages, threaded by that appointment.
- Sending is allowed while the appointment is `BOOKED`; the thread remains readable by both
  participants while it is `BOOKED` or `COMPLETED` (matching the existing consultation-workspace
  and medical-records access window). No other status exposes the thread.
- Messages are persisted in PostgreSQL via Prisma and delivered live to a participant who already
  has the app open, by reusing the existing authenticated Socket.io connection and appointment
  room (`add-consultations-and-records`'s `consultation:subscribe`) — no new realtime dependency.
- A new `NEW_MESSAGE` notification is created (in the same transaction as the message) for the
  recipient, following the existing in-app notification pattern — no email/SMS/push.
- Admin appointment oversight (`admin-appointments`) gains a message count and last-message
  timestamp per appointment, for operational visibility only. Administrators cannot read message
  content, consistent with the existing "admins cannot read clinical notes" rule and the
  consultation workspace's "no one else, including administrators" access rule.
- Web: a new "Messages" card on the patient and doctor appointment-detail pages, showing the
  thread and a send box, live-updating while open. The same card is also mounted inside the
  consultation workspace page (`add-consultation-video`'s workspace, in-flight alongside this
  change), alongside the video call and the doctor's notes/prescriptions — the same thread, same
  component, reused in both places rather than duplicated. The workspace response DTO also gains
  the appointment's own `status` field (distinct from its session state) so the web app can gate
  the card the same way the API does.
- No external SaaS/BaaS/runtime API is introduced. All storage (PostgreSQL), delivery (self-hosted
  Socket.io), and notification (existing in-app notifications table) stay inside the stack already
  running in Docker Compose.
- Modules affected: **Patient** and **Doctor** (send/read messages on their shared appointment),
  **Admin** (metadata-only oversight). The **Product Website** module is not affected.

## Capabilities

### New Capabilities
- `consultation-messaging`: patient-doctor text messaging scoped to a single appointment —
  sending, listing/paginating a thread, access control, and live delivery.

### Modified Capabilities
- `notifications`: adds a "new message" notification trigger (a new `NotificationType` value and
  creation rule), alongside the existing appointment-event notifications.
- `admin-appointments`: the appointment list/detail gains a message count and last-message
  timestamp for oversight; explicitly excludes message content, mirroring the capability's
  existing "MUST NOT include ... notes, prescriptions, or medical history" rule.

## Impact

- `apps/api/prisma/schema.prisma`: new `Message` model (appointment-scoped, `senderId`, `body`,
  `createdAt`), a new migration, and a new `NotificationType.NEW_MESSAGE` value (added in its own
  migration per this repo's existing enum-versioning convention).
- `apps/api/src/messages/`: new module (`messages.controller.ts`, `messages.service.ts`,
  `messages.module.ts`, `dto/`), mirroring `apps/api/src/consultations/`'s structure. Applies the
  existing `RateLimitGuard` (`common/rate-limit/`) to the send endpoint, the same way
  `auth.controller.ts` already does, to bound message-send frequency.
- `apps/api/src/realtime/realtime.gateway.ts` / `rooms.ts`: no new subscribe handler — reuses the
  existing `consultation:subscribe` appointment room and `emitToRoom` helper to broadcast a new
  `message:new` event.
- `apps/api/src/notifications/`: new `NotificationDraft` usage for `NEW_MESSAGE`, built the same
  way `add-consultations-and-records` builds `CONSULTATION_SUMMARY_AVAILABLE`.
- `apps/api/src/admin-appointments/`: list/detail query and response DTO gain `messageCount` and
  `lastMessageAt`, sourced from an aggregate over `Message`, never the message rows themselves.
- `apps/web/src/components/appointment-messages-card.tsx`: a new, shared "Messages" card (thread +
  send box, `QueryState` for the thread query per this repo's established convention, plus a small
  socket hook patterned after `use-consultation-socket.ts`'s presence hook for live updates),
  mounted from three places: `apps/web/src/routes/patient/appointment-detail.tsx`,
  `apps/web/src/routes/doctor/appointment-detail.tsx`, and the consultation workspace
  (`apps/web/src/routes/consultation/workspace.tsx`, both `DoctorPanel` and `PatientPanel`) — one
  component, reused rather than duplicated across the two surfaces.
- `apps/web/src/routes/admin/appointments.tsx`: surfaces the new message-count/last-message
  columns.
- `packages/api-client`: regenerate (`pnpm openapi:generate`) after the new endpoints/DTOs land.
- Docs: `docs/modules/patient.md` and `docs/modules/doctor.md` gain a short messaging mention;
  `docs/modules/admin.md` (if present) notes the metadata-only oversight.
- `apps/api/src/consultations/dto/consultation-response.dto.ts` /
  `apps/api/src/consultations/consultations.service.ts`: the workspace response gains the
  appointment's own `status` field (distinct from its session state), so the workspace page can
  gate the reused messages card exactly the way `AppointmentMessagesCard` already expects
  (`BOOKED` sendable, `COMPLETED` read-only, otherwise hidden) — the only change this makes to
  `add-consultation-video`'s workspace module. Messaging is deliberately independent of session
  state (`SCHEDULED`/`JOINED`/`IN_PROGRESS`/`COMPLETED`): it's available any time the appointment
  is `BOOKED`, not gated to the live join window.
