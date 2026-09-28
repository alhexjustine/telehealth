# Design

## Context

See `proposal.md` - Why for motivation. The consultation workspace
(`apps/api/src/consultations/`, `apps/web/src/routes/consultation/workspace.tsx`) already tracks
session state and gates the workspace to its two participants; this change adds a video surface
without touching that state machine.

The web app's nginx config (`apps/web/nginx.conf`) sends a strict CSP on `location /`:
`default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; connect-src 'self'
ws: wss:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`. `connect-src` already
allows any `ws:`/`wss:` host (scheme-only source, no host restriction), so Jitsi's websocket
signaling is unaffected. `script-src` and `frame-src` have no explicit directive, so both fall
back to `default-src 'self'` and would block loading `meet.jit.si`'s script and the iframe it
creates.

## Goals / Non-Goals

**Goals:**
- A working, embedded video call between patient and doctor once the consultation is `IN_PROGRESS` (started).
- A room identifier that isn't the raw appointment ID or otherwise guessable.
- Everything needed for evaluators to notice this is a documented, deliberate exception, not an
  accidental gap.

**Non-Goals:**
- Self-hosting Jitsi, TURN/STUN, or any new Docker Compose service (see proposal.md; explicitly
  declined for this change).
- Recording, in-call chat beyond Jitsi's own defaults, screen share configuration, or any other
  Jitsi feature toggling beyond what's needed for a clean embedded call.
- Any change to session state, join-window, or start/complete rules.

## Decisions

**Room identifier: HMAC-derived, not stored.**
`roomId = 'consult-' + HMAC-SHA256(JITSI_ROOM_SECRET, appointmentId).hex().slice(0, 32)`, computed
in `ConsultationsService.getWorkspace` (or a small helper alongside it) each time, not persisted.
- *Alternative considered*: a random token generated at booking time and stored on the
  appointment/consultation-session row. Rejected because it needs a Prisma migration and a
  backfill for existing (including demo-seeded) appointments, for no real benefit over a derived
  value here — a prototype has no requirement to rotate room identifiers independently of the
  secret, and an HMAC is exactly as "not guessable without server-side data" as a stored random
  token.
- New env var `JITSI_ROOM_SECRET` (same explicit-config pattern as other flags in
  `env.schema.ts`), required non-empty string, no default in `env.schema.ts` itself but given a
  clearly-marked local-only value in `docker-compose.yml`/`.env.example` (e.g.
  `dev-only-change-me`), the same way `ADMIN_PASSWORD` is documented as something to change for
  anything beyond local use.

**Client library: `@jitsi/react-sdk`'s `JaaSMeeting`/`JitsiMeeting` component, not a hand-rolled
`<script>` tag.**
- *Alternative considered*: manually append `https://meet.jit.si/external_api.js` to `<head>` and
  call `new JitsiMeetExternalAPI(...)` directly. Rejected because the React SDK (an open-source
  npm package that wraps exactly that same script/API) already handles script loading, mount/
  unmount lifecycle, and cleanup correctly inside a component, which is meaningfully less fiddly
  and less error-prone in a React app than hand-managing a global script tag and imperative
  teardown on unmount/route change.
- Important distinction for the standalone-runtime deviation: the **npm package** is open source
  and installed normally (no issue there); the **exception** is what it does at runtime — loads
  `meet.jit.si`'s script and connects to Jitsi's hosted infrastructure. That's the actual
  deviation, and it's what proposal.md and the spec delta call out.
- Configure `configOverwrite: { prejoinConfig: { enabled: false }, prejoinPageEnabled: false }`
  (the workspace's own join gating already establishes who's allowed in) and
  `userInfo: { displayName, email }` from the current user, so Jitsi's own prejoin/name-entry
  screen doesn't duplicate what the workspace already handles. (Both flags are set: the older
  flat `prejoinPageEnabled` had no effect against the currently-deployed `meet.jit.si`, which has
  moved to the nested `prejoinConfig.enabled` — confirmed by live testing during implementation.)

**CSP update.** Add `meet.jit.si` (and its `8x8.vc`-hosted asset CDN, which `meet.jit.si` itself
loads from) to `script-src` and `frame-src` in `apps/web/nginx.conf`'s `location /` block, e.g.:
`script-src 'self' https://meet.jit.si https://8x8.vc; frame-src https://meet.jit.si;` — added as
new directives alongside the existing ones, not replacing `default-src`. `connect-src` needs no
change (see Context). Verify against the real script in a browser during implementation, since
Jitsi's exact asset hosts can shift between releases; treat the CSP addition as a starting point
to confirm, not a fixed final list.

**Where the room identifier lives in the API surface.** Added to
`ConsultationWorkspaceResponseDto` (returned by the existing `GET /consultations/:appointmentId`)
rather than a new endpoint — it's participant-only data already gated by that route's existing
404/403 checks, so no new authorization logic is needed.

## Risks / Trade-offs

- **External dependency reliability**: `meet.jit.si` is a community server with no uptime
  guarantee (see the earlier conversation's production-readiness discussion). Acceptable here
  because this is explicitly a prototype-only, user-confirmed deviation. → Mitigation: document it
  prominently (README/demo notes) so it reads as a known limitation, not a bug, if it's ever flaky
  during a demo or evaluation.
- **Privacy**: real (if fictional) patient/doctor video would transit a third-party server in a
  non-prototype deployment. → Mitigation: same documentation note explicitly frames this as
  unsuitable beyond prototype use.
- **CSP drift**: Jitsi's asset hosts can change across their releases, silently breaking the
  embed with a CSP violation (console-only, easy to miss). → Mitigation: call this out as an
  explicit manual verification step in tasks.md (open the browser console while testing).
- **HMAC secret handling**: if `JITSI_ROOM_SECRET` is ever weak/default in a non-local deployment,
  room identifiers become guessable. → Mitigation: same treatment as `ADMIN_PASSWORD` — documented
  as something that must be changed outside local/demo use.

## Documentation

- README (or `docs/guide/demo.md`, wherever the existing demo/setup notes live): add a short,
  visible note that the consultation video call uses Jitsi's public `meet.jit.si` server, listed
  as a known deviation from the standalone-runtime rule, for prototype purposes only.
- `docs/` technical documentation: the `consultation-session` capability's per-module page (under
  the Patient/Doctor module docs, per this repo's documented-per-module structure) should mention
  the video call and this same external-dependency note.
