# Proposal

## Why

The consultation workspace currently only tracks session state (`SCHEDULED` → `JOINED` →
`IN_PROGRESS` → `COMPLETED`); once a patient and doctor "join," nothing actually connects
them — no audio, no video, no visible sign the other side is even in a call. That leaves the
core journey's "patient and doctor join the consultation session" step incomplete in practice,
even though the state machine behind it is fully implemented and tested.

## What Changes

- Embed a live Jitsi Meet video call directly in the consultation workspace page, for both the
  patient and the doctor, shown once the doctor has started the consultation (`IN_PROGRESS`). Uses Jitsi's
  Meet External API (`https://meet.jit.si/external_api.js`) against Jitsi's free public server —
  no Jitsi account required, anonymous join.
- The workspace API response gains a server-derived room identifier for the appointment (not the
  raw appointment UUID) so the video room can't be found by guessing/enumerating appointment IDs.
  The mapping lives server-side (in the `consultations` module) so it stays the single source of
  truth and could later support a self-hosted, JWT-gated room without a frontend rework.
- No change to the session state machine, the join window, or the start/complete gating rules —
  this is purely an added video surface over the existing, already-correct workspace.
- **Explicit, documented deviation from this repo's standalone-runtime rule**: this introduces a
  dependency on a hosted third-party service (Jitsi's public `meet.jit.si` server) for real-time
  video, which the project's mandatory constraints otherwise prohibit (no external SaaS/BaaS for
  conferencing). Self-hosting Jitsi's open-source components (Prosody/Jicofo/JVB) inside Docker
  Compose was considered and would have avoided this, but was explicitly declined for this
  prototype in favor of the simpler public-server integration. This must be called out visibly
  (README and/or demo notes) as a known, deliberate exception — not a silent gap — so it's visible
  during evaluation.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `consultation-session`: adds a "Video" requirement (an embedded Jitsi call shown during
  `IN_PROGRESS`) and extends the workspace response with a room identifier. The
  capability's current Purpose statement — "with no external conferencing service" — becomes
  inaccurate and will be rewritten when this change is archived into the main spec.

## Impact

- `apps/api/src/consultations/`: `ConsultationWorkspaceResponseDto` gains a room-identifier field;
  `ConsultationsService.getWorkspace` derives it server-side from the appointment ID. No change to
  `consultation-state.ts`'s transition logic.
- `apps/web/src/routes/consultation/workspace.tsx`: loads Jitsi's External API script and mounts a
  call inside the workspace for both `DoctorPanel` and `PatientPanel` once `IN_PROGRESS`.
- `packages/api-client`: regenerate after the DTO change (`pnpm openapi:generate`).
- New runtime dependency: `meet.jit.si` (Jitsi's free public server), loaded client-side only —
  no new backend/Docker Compose service. Documented as a known standalone-runtime exception.
- Docs: README (or demo notes) gets a short note flagging the video feature's external dependency.
