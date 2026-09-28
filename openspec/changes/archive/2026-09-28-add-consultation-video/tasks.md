# Tasks

## 1. API: room identifier

- [x] 1.1 Add `JITSI_ROOM_SECRET` (required non-empty string, no default) to `apps/api/src/config/env.schema.ts`; verify with a unit test in `env.schema.spec.ts` asserting `validateEnv` rejects a missing/empty value
- [x] 1.2 Add a `consultationRoomId(appointmentId, secret)` helper (e.g. alongside `consultation-state.ts`) computing `'consult-' + HMAC-SHA256(secret, appointmentId).hex().slice(0, 32)`; verify with a unit test asserting the result is deterministic, not equal to `appointmentId`, and changes if the secret changes
- [x] 1.3 Add a `roomId` field to `ConsultationWorkspaceResponseDto` and populate it in `ConsultationsService.getWorkspace` using the helper and the injected `ConfigService<Env, true>`; verify with the "Workspace response includes the video room identifier" e2e scenario in `test/consultations-workspace.e2e-spec.ts` (or the equivalent existing workspace e2e file)
- [x] 1.4 Run `pnpm openapi:generate` and verify `packages/api-client/src/schema.d.ts` gains the `roomId` field with no unrelated diff

## 2. Web: embedded video call

- [x] 2.1 Add `@jitsi/react-sdk` to `apps/web/package.json`; verify `pnpm install` and `pnpm --filter web run typecheck` succeed
- [x] 2.2 Add a `ConsultationVideoCall` component (new file under `apps/web/src/routes/consultation/` or `apps/web/src/components/`) wrapping `@jitsi/react-sdk`'s meeting component, configured with `roomName={data.roomId}`, `configOverwrite: { prejoinPageEnabled: false }`, and `userInfo: { displayName }` from the current user
- [x] 2.3 Mount `ConsultationVideoCall` in `workspace.tsx` once `session.state` is `IN_PROGRESS` (not merely `JOINED` — starting the consultation is the gate, per user feedback during manual testing); verify with tests in `workspace.test.tsx` for the "Video call shown once the consultation starts", "No video while only joined, not yet started", and "No video before the consultation starts or after it completes" scenarios (assert the component/its container renders or doesn't, without needing a real Jitsi connection — mock `@jitsi/react-sdk`'s component the same way `socket.io-client` is already mocked in that test file)

## 3. Infra: CSP and configuration

- [x] 3.1 Add `meet.jit.si` (and its asset CDN host, confirmed by inspecting the browser's console/network tab against the real script) to `script-src` and add a `frame-src` directive in `apps/web/nginx.conf`'s `location /` CSP; verify by loading the workspace in a browser with the video call active and confirming no CSP violation appears in the console
- [x] 3.2 Add `JITSI_ROOM_SECRET` to `docker-compose.yml`'s `api` service environment (with a clearly-marked local-only default, e.g. `${JITSI_ROOM_SECRET:-dev-only-change-me}`) and to `.env.example`, documented the same way `ADMIN_PASSWORD` is; verify `docker compose config` resolves the variable with no warning

## 4. Documentation

- [x] 4.1 Add a visible note to the README (or `docs/guide/demo.md`) disclosing that the consultation video call uses Jitsi's public `meet.jit.si` server as a documented, prototype-only exception to the standalone-runtime rule; verify by reading the rendered note back
- [x] 4.2 Update the `consultation-session` capability's technical documentation page(s) under the Patient/Doctor module docs to mention the video call and the same external-dependency note; verify with `pnpm docs:build`

## 5. Verification

- [x] 5.1 Run `pnpm --filter api run test`, `pnpm --filter api run test:e2e`, `pnpm --filter web run test`, `pnpm --filter api run lint`, `pnpm --filter web run lint`, `pnpm --filter api run typecheck`, `pnpm --filter web run typecheck`; verify all pass
- [x] 5.2 Rebuild and restart the Docker stack (`docker compose up --build -d`); manually verify in two separate browser sessions (doctor + patient) that joining a consultation shows a working two-way video/audio call with no console errors
- [x] 5.3 Run `pnpm traceability`; verify every new scenario in the `consultation-session` spec delta maps to a test
