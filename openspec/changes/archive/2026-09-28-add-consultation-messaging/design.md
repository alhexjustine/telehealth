# Design

## Context

See `proposal.md` for motivation. Relevant existing pieces this builds on:

- `apps/api/src/realtime/realtime.gateway.ts` already authenticates sockets into `socket.data`
  and exposes `joinRoom`/`emitToRoom` helpers plus a `consultation:subscribe` handler
  (`add-consultations-and-records`) that validates a participant via
  `ClinicalAccessPolicy.canViewWorkspace` and joins `appointmentRoom(appointmentId)`.
- `apps/api/src/notifications/with-notifications.ts`'s `withNotifications(prisma, notify, fn)`
  is the standard way every other module creates notifications transactionally with their
  triggering write, then calls `NotificationsGateway.publish(...)` after commit.
- `apps/api/src/common/rate-limit/rate-limit.guard.ts` (`@UseGuards(RateLimitGuard)` +
  `@RateLimit({ limit, windowMs })`) is currently only used by `auth.controller.ts`; this is its
  second consumer.
- `openspec/changes/add-consultation-video/` (in-flight alongside this change) added a `roomId`
  field to `ConsultationWorkspaceResponseDto` and a `consultation-session` spec delta, and embeds
  the video call in `apps/web/src/routes/consultation/workspace.tsx`. Messaging gets its own
  capability, module, and DTOs — the only shared touch point is reusing
  `AppointmentMessagesCard` inside that same workspace page (see "UI reuse" below) and adding one
  more field, `status`, to the same response DTO.

## Goals / Non-Goals

**Goals:**
- Persisted, appointment-scoped, two-party text messaging with live delivery when both sides are
  already connected, entirely inside the existing stack.
- Reuse existing infrastructure (realtime gateway, notifications, rate limiting) rather than
  building parallel mechanisms.
- Keep admin oversight strictly metadata-only, consistent with the project's existing clinical-
  privacy rules.

**Non-Goals:**
- Read receipts / per-message "seen" state. Deferred — see Decisions.
- File/image attachments. Text only, matching the "no external file storage" constraint and
  keeping scope tight for a bonus feature.
- Group or multi-appointment threads. One thread per appointment, exactly two participants.
- Message editing or deletion. Messages are append-only, matching the audit-friendly posture of
  the rest of the system (e.g. consultation notes are replace-only, not deletable).

## Decisions

**Thread key: appointment ID, not a separate conversation ID.**
An appointment already uniquely pairs one patient with one doctor for a bounded engagement, and
every other capability (workspace, medical records) threads off the same key. A separate
`Conversation` entity was considered (to support, e.g., a standing patient-doctor relationship
across appointments) but rejected: it adds a second identity concept for no current requirement,
and the brief's core journey is appointment-centric throughout.

**Access window: send while `BOOKED`, read while `BOOKED` or `COMPLETED`.**
This exactly mirrors `consultation-session`'s workspace-access rule and `medical-records`'
patient/doctor read rule, so reviewers and future contributors find one, already-familiar access
pattern rather than a new one specific to messaging. Allowing send after `COMPLETED` was
considered (e.g. a follow-up question after the visit) and rejected for this version: it would
need its own time-boxed window (open-ended post-visit messaging has no natural end), which is
extra design surface for a bonus feature; a completed visit's follow-up naturally becomes a new
appointment.

**UI reuse: one `AppointmentMessagesCard`, mounted on both the appointment-detail page and the
consultation workspace.**
Rather than building two separate messaging UIs, `AppointmentMessagesCard` takes only
`appointmentId` and `status` and is mounted from three call sites (patient appointment-detail,
doctor appointment-detail, and both `DoctorPanel`/`PatientPanel` in the consultation workspace).
This was chosen over a workspace-specific variant (e.g. a tabbed Notes/Prescriptions/Messages
panel for the doctor, as an early mockup explored) because the card's own access-window logic
(`showThread`/`canSend` from `status`) is the single place that decision lives — a second,
workspace-only implementation would risk the two surfaces drifting out of sync. The workspace
page's DoctorPanel currently renders it as one more stacked card alongside the notes/prescriptions
editor and the video call, not as a tab; revisiting that as a tabbed layout remains open for a
later, presentation-only change if the stacked layout feels crowded in practice.

**Delivery: reuse `consultation:subscribe`'s existing appointment room, add one new event.**
Rather than adding a second `@SubscribeMessage` handler with its own access check, the messages
module publishes to the same `appointmentRoom(appointmentId)` that `consultation:subscribe`
already gates behind `ClinicalAccessPolicy.canViewWorkspace` (participants only). A client that
has the appointment detail page open subscribes the same way the workspace page already does.
This was chosen over a new `message:subscribe` handler to avoid a second, parallel authorization
check for the same room.

**No read receipts in this version.**
Read receipts need per-recipient state (who has seen which message) and a UI for it, and nothing
in the proposal's "ask a quick question" motivation depends on it — the `NEW_MESSAGE`
notification and unread badge already tell a recipient a message is waiting. Deferred as an
open question for a later change if reviewers want it.

**Rate limiting: per-sender, per-route, via the existing `RateLimitGuard`.**
Consistent with the repo's explicit rule against `@nestjs/throttler` (ESM/CJS interop breaks
Jest). A conservative limit (e.g. 20 sends/minute/user) blocks accidental double-submits and
scripted abuse without affecting a real conversation's pace.

**Admin metadata: derived aggregate, not a stored counter.**
`messageCount`/`lastMessageAt` are computed with a Prisma aggregate (`count`, `max(createdAt)`)
per appointment at query time, not a denormalized counter column. The admin appointment list is
already paginated and filtered, not a hot path, so the extra aggregate join is cheap and avoids
keeping a counter in sync.

## Risks / Trade-offs

- **[Risk] A participant not currently subscribed to the appointment room misses the live event
  entirely.** → Mitigation: the message is already persisted before the emit; the appointment
  detail page's message list is a normal paginated query, so it's there on next load or poll,
  matching the existing "fallback without a live connection" pattern for notifications.
- **[Risk] Unbounded thread growth on a single appointment (e.g. abusive spam within the rate
  limit).** → Mitigation: the rate limit bounds the rate; a 2000-character cap bounds size per
  message. No hard cap on thread length in this version — acceptable for a prototype's fictional
  data volumes.
- **[Trade-off] Metadata-only admin visibility means an administrator investigating a dispute
  cannot see what was actually said.** → Accepted deliberately: this matches the project's
  existing "admins cannot read clinical notes" stance, and messaging is treated the same way.

## Documentation

- `docs/modules/patient.md` and `docs/modules/doctor.md`: add a short "Messaging" mention under
  the appointment-detail description.
- `docs/api` (generated Swagger/OpenAPI reference): picked up automatically once
  `pnpm openapi:generate` regenerates `packages/api-client` from the new controller's
  `@Api...Response` decorators.
- No change needed to the C4 diagrams — this adds a new NestJS module and a Prisma table inside
  the existing Backend API / PostgreSQL containers, not a new container or external dependency.
