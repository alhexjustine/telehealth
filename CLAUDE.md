# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

The `setup-foundation` change scaffolded the workspace: `apps/api` (NestJS + Prisma),
`apps/web` (React + Vite SPA), `packages/api-client` (generated OpenAPI client), and `docs`
(VitePress). The `add-authentication` change (implementation in progress; not yet archived) adds
application-managed accounts, sessions, role-based access control, the pre-provisioned admin, and
patient/doctor profiles. Matching, booking, consultations, and the admin console still don't
exist — see `openspec/changes/` for what's in flight.

### Commands

```bash
pnpm install                    # install the workspace
docker compose up --build       # full stack: postgres, api, web (nginx) — no .env required
pnpm dev                        # api (:3000) + web (:5173) natively, against pnpm db:up's postgres
pnpm db:up / db:down / db:migrate  # Postgres-only container for native dev (docker-compose.dev.yml)

pnpm lint / typecheck / build   # across every package
pnpm test                       # unit tests, every package
pnpm test:e2e                   # apps/api e2e tests (builds api, migrates the telehealth_test db)

# Single API test (unit or e2e), by file or by name
pnpm --filter api run test -- src/config/env.schema.spec.ts
pnpm --filter api run test -t "Missing database URL"
pnpm --filter api run test:e2e -t "Database unreachable"

# Single web test file
pnpm --filter web exec vitest run src/routes/status.test.tsx

pnpm openapi:generate            # regenerate packages/api-client from apps/api's OpenAPI doc
pnpm docs:dev / docs:build       # VitePress technical documentation site
```

### Repo layout

```
apps/api             NestJS + Prisma REST API (src/, prisma/, test/)
apps/web              React + Vite SPA (src/routes, src/components/ui, src/lib)
packages/api-client   Generated OpenAPI types + typed fetch client (openapi.json, src/schema.d.ts committed)
docs                   VitePress site: architecture, per-module pages, API reference
openspec               Spec-driven change workflow (proposals, specs, design, tasks)
docker-compose.yml      Full stack; docker-compose.dev.yml — Postgres only, for native dev
```

See `README.md` for the full command reference and local-development walkthrough.

### Gotchas

- `apps/api` is ESM (NestJS 12 ships ESM only): relative imports need `.js` extensions, and Jest
  runs in ESM mode. Don't run the API through tsx/esbuild — it drops decorator metadata and breaks
  DI; use `tsc` output.
- TypeScript is pinned to 5.9.x because typescript-eslint and ts-jest don't support TS 7 yet.
- Prisma 7: `prisma.config.ts` + `prisma-client` generator (output in `apps/api/src/generated`)
  + `@prisma/adapter-pg`. The generated client is gitignored and the install hook only generates
  it when missing (it can't run inside `pnpm deploy`'s pruned output), so run
  `pnpm --filter api run prisma:generate` after every `schema.prisma` change. The client connects lazily; that's what lets `openapi:generate` and the
  "database down" health check work without Postgres.
- OpenAPI paths are generated without the `/api` prefix; `createApiClient()` defaults its base URL
  to `/api`.
- Auth is deny-by-default: `SessionAuthGuard` and `RolesGuard` are global `APP_GUARD`s, so every
  new controller/route requires a signed-in user unless it carries `@Public()`, and every
  `@Roles(...)`-restricted route rejects the wrong role. Forgetting `@Public()` on a route meant
  to be open fails closed (401), not open — safe by default, but easy to notice in tests.
- Don't add `@nestjs/throttler`: its CommonJS build `require()`s `@nestjs/common`, which is
  ESM-only under NestJS 12. Real Node 24 handles that via `require(esm)`, but Jest's synthetic
  CJS module loader doesn't, and it breaks every e2e test that touches the module graph (`Must
  use import to load ES Module`). Use `src/common/rate-limit/rate-limit.guard.ts` (a small
  in-memory, per-route, per-IP limiter with no such dependency) for anything throttling-shaped.
- `@nestjs/swagger` only picks up a route's response schema from an explicit `@ApiOkResponse`/
  `@ApiCreatedResponse({ type: SomeDto })` decorator — never from the handler's TS return type
  alone. Skipping it doesn't break the build, but `openapi-typescript` then generates that
  operation's success response with no `content` (`responses: { 200: { content?: never } }`),
  and destructuring `{ data, error, response }` from an `openapi-fetch` call to it makes
  `response`'s inferred type collapse to `never` the moment you narrow on `error` (there's
  no documented error schema either, so `error`'s type is `never` too) — a real TS error, not a
  runtime one. Check `response.ok`/`response.status` directly instead of narrowing on `data`/
  `error` (see `apps/web/src/lib/api-error.ts`'s `unwrap`/`assertOk`), and always add the
  `@Api...Response({ type })` decorator so the client gets a real type in the first place.
- `pino-http`'s `serializers.req` callback does **not** receive the live Express `request`; it
  receives `pino-std-serializers`' own pre-summarized object (`{ id, method, url, headers, ... }`)
  with the real request under the non-enumerable `.raw` key. Anything computed from the live
  request per-request (like the real client IP behind nginx) needs to be captured early by a
  request-scoped Express middleware onto a custom property (see `clientIpMiddleware` and
  `logging.module.ts`'s `serializers.req`), not read lazily inside the serializer itself —
  `req.ip` read there is already stale and resolves to `undefined`.
- `@date-fns/tz`'s `TZDate#toISOString()` formats with its own zone offset (e.g. `...+08:00`),
  not `Z` — unlike a plain `Date`. To get a UTC-`Z` ISO string for the API (timestamps, time-off
  instants) from a `TZDate`, wrap it: `new Date(tzDate.getTime()).toISOString()`. See
  `apps/web/src/lib/availability/time-off-conversion.ts`.
- Prisma 7 + `@prisma/adapter-pg`: the real PostgreSQL SQLSTATE behind a query error is **not**
  `PrismaClientKnownRequestError.code` (that's Prisma's own `P20xx` code for which operation
  failed — confirmed to be `P2010` for `$executeRaw`/`$queryRaw` but `P2039` for a normal
  `.create()`/`.update()` hitting the same constraint, so branching on it is unreliable) and
  **not** reliably `meta.code` either. It's three levels down, at
  `exception.meta.driverAdapterError.cause.code` (and the constraint name is embedded in
  `...cause.message`, e.g. `conflicting key value violates exclusion constraint "..."`). See
  `apps/api/src/common/errors/postgres-error.ts`'s `postgresErrorCode`/`postgresConstraintName`,
  used by the appointment-overlap exclusion-constraint handling in `add-appointment-booking`.
- A hand-written migration that resolves a foreign key by a subquery across a `UNION ALL` of
  `SELECT`s (e.g. `SELECT '<uuid-literal>', sp.id, weight FROM specializations sp WHERE sp.slug =
  '...'`, repeated per row so the migration doesn't have to hardcode the target table's UUIDs)
  needs the literal cast explicitly: `'<uuid-literal>'::UUID`. Postgres infers a bare string
  literal's type as `text`, and a `UUID NOT NULL` target column then fails to insert with `column
  "..." is of type uuid but expression is of type text` — cheap to miss because a single
  `INSERT ... VALUES` with real UUID columns needs no such cast. See
  `apps/api/prisma/migrations/20260925103000_add_symptom_catalog/migration.sql`.
- Unlike `@nestjs/throttler`, `@nestjs/schedule`, `@nestjs/websockets`, and
  `@nestjs/platform-socket.io` are genuinely `"type": "module"` ESM packages (not a CJS build
  `require()`-ing an ESM-only one), so they import fine under Jest's ESM mode — no plain-`setInterval`
  or raw-`socket.io`-`Server` fallback was needed for `add-notifications`.
- A genuine two-way constructor-injection dependency between two Nest providers (`SessionService`
  needs the realtime gateway to disconnect sockets on revocation; the gateway needs
  `SessionService` to validate handshakes) can't be fixed with `forwardRef` alone when one side's
  constructor parameter is typed as the other's real class: `emitDecoratorMetadata` emits that
  class as a plain value in `design:paramtypes` at class-definition time (eager), not lazily like
  `forwardRef`'s own callback, so whichever file's module evaluates first throws `ReferenceError:
  Cannot access '<Class>' before initialization` — and if you only fix one side, Nest's DI
  container deadlocks instead (silent hang, `NestFactory.create()` never resolves; the "unsettled
  top-level await" trace names the actual `await`, not the cycle, so tracking it down needs a
  minimal repro module). `forwardRef` still works for the *module-level* `imports: [...]` array on
  both sides (that's a plain decorator argument, not a typed parameter). Fix the *provider-level*
  cycle by breaking it with a token + interface on one side instead of the real class (see
  `apps/api/src/auth/session/session-realtime-notifier.ts`), and keep `forwardRef` on the
  remaining, now one-directional, class injection.
- Global HTTP guards (`SessionAuthGuard`/`RolesGuard`, registered as `APP_GUARD`) also run for a
  gateway's `@SubscribeMessage` handlers, not just HTTP routes — Nest's guard pipeline is
  transport-agnostic. Both guards call `context.switchToHttp().getRequest()`, which is meaningless
  for a WS message and makes them throw "Sign in required"/403 on *every* socket message,
  independent of whether the socket itself is genuinely authenticated. `handleConnection`/
  `handleDisconnect` never hit this (they're gateway lifecycle hooks, not guarded handlers), which
  is why `RealtimeGateway` never needed `@Public()` until it grew its first `@SubscribeMessage`
  method (`add-consultations-and-records`'s `consultation:subscribe`) — mark the whole gateway
  class `@Public()` and do auth entirely via `socket.data` (set by `authenticate()`) inside each
  handler. Diagnosing this needs the client's `exception` event (`socket.on('exception', ...)`) —
  the default `BaseWsExceptionFilter` reports the real cause there, but Nest's own `Logger.error`
  call for it is silent in the test harness (`test/support/test-app.ts` never calls
  `app.useLogger(...)`, unlike `main.ts`).
- A socket client's own `connect` event fires once the transport handshake completes, which is
  *before* `RealtimeGateway.handleConnection`'s async `authenticate()` (a DB round trip) has
  necessarily finished — so a message emitted right after `await waitForEvent(socket, 'connect')`
  can still arrive with `socket.data.userId` unset. Existing notification tests never hit this
  because they always awaited an unrelated DB call first, which incidentally gave `authenticate()`
  enough time. A handler reachable this way (e.g. `consultation:subscribe`) must treat "not yet
  authenticated" as a normal, retryable `{ok: false}`, not an error — see
  `test/consultations-realtime.e2e-spec.ts`'s `subscribeUntilAuthenticated` retry helper and
  `src/realtime/realtime.gateway.spec.ts`'s direct-call unit tests for the deterministic version.
- In-memory per-room state in a gateway (e.g. consultation presence, keyed by appointment) should
  cache whatever it needs (here, `patientId`/`doctorId`) at the point a socket *joins*, not re-fetch
  it from the DB when a socket *leaves*. `OnGatewayDisconnect.handleDisconnect` returns `void`
  (can't be awaited by the framework), so a fire-and-forget DB query there is exactly the kind of
  dangling handle Jest's "did not exit one second after the test run" warning is about — sockets
  disconnect during `afterEach`, and `app.close()` can race an in-flight query from that cleanup.

## What this repo is building

A prototype telehealth web app: a public product website plus Patient, Doctor, and Admin
experiences, evaluated on functionality, product/design sense, code quality, and presentation —
not feature quantity. The brief's 4-hour timebox is being ignored for this build; favor doing
things properly over shortcuts. Bonus features are out of scope until the core is complete.

**Core user journey:** visitor → registers/signs in as patient or doctor → patient completes
profile → discovers a doctor (availability/specialization/symptom matching) → books/reschedules/
cancels a consultation → patient and doctor join the consultation session → doctor records notes/
prescription → patient views it later.

## Mandatory technical constraints

These are hard requirements from the brief, not suggestions — code review and evaluation depend
on them:

- **Stack:** Next.js or React+Vite frontend, NestJS backend, Prisma ORM + PostgreSQL, REST/JSON
  over HTTP(S), TypeScript on both frontend and backend, pnpm as the package manager.
- **Standalone runtime — no external SaaS/BaaS/APIs.** Every core feature (auth, doctor matching,
  notifications, messaging, file storage, scheduling, conferencing, medical records) must be
  implemented in the frontend + NestJS + Prisma + PostgreSQL stack itself. No external auth
  providers, calendar/scheduling services, notification/email/SMS/push services, AI matching
  APIs, file/image hosting, analytics platforms, or CMS/form/marketing SaaS. Open-source
  npm/library packages are fine; hosted third-party services are not.
- **Auth:** application-managed email/password only (no third-party auth providers). Admin
  accounts are pre-provisioned — there is no public admin registration flow.
- **Doctor matching:** deterministic specialty-matching rules implemented in NestJS — not a call
  to an external AI service.
- **Avatars/files:** generated initials or an app-provided avatar — no external file storage.
- **Notifications:** database-backed in-app notifications only — no email/SMS/push.
- **Consultation session:** a first-party workspace tracking scheduled/joined/in-progress/completed
  state — audio/video streaming and external conferencing are explicitly not required.
- **Local deployment:** frontend, NestJS backend, and PostgreSQL must run via Docker Compose.
- **Bonus cloud deployment** (optional): Netlify/Fly.io/Railway/Vercel are fine, but must not
  introduce SaaS/BaaS/external feature-API dependencies.
- Bonus features are welcome but must stay telehealth-relevant and obey the standalone-runtime
  rule above — no exceptions for "just this one bonus feature."

## Architecture (four modules, one deployable app)

The product website and the three role-based apps are served from the same frontend container
(single Next.js/React app with routing by role), talking to a single NestJS backend over REST,
backed by one PostgreSQL database via Prisma.

- **Product Website** — public landing page (value prop, how-it-works), nav/CTAs into patient
  registration, doctor registration, and sign-in. Fictional-prototype disclaimer plus
  privacy/terms pages, all served as app-managed content — no external CMS/analytics/forms.
- **Patient** — registration/profile (name, birthday, weight, height, contact, medical history),
  doctor discovery + guided matching, booking/reschedule/cancel, in-app notifications,
  consultation workspace, medical records/prescriptions view (role-scoped in NestJS).
- **Doctor** — registration/profile (bio, specialization), patient records view (role-scoped),
  availability/schedule management with overlap/conflict prevention in NestJS, in-app
  notifications, consultation notes/prescriptions authoring, consultation workspace.
- **Admin** — pre-provisioned sign-in only, user management (activate/suspend/deactivate with
  stored reasons), doctor profile review/approval, appointment oversight (view/cancel/resolve),
  operational dashboard (DB-derived counts), audit log of admin actions.

Role-based access control (patient/doctor/admin) must be enforced in NestJS, not just hidden in
the frontend — the Admin, Doctor, and Patient modules share underlying tables (users, appointments,
consultations) and differ by permission scope, not by separate databases.

## Deliverables to keep in mind while building

- Docker Compose config + local setup instructions (must actually bring the stack up).
- A ≤15-minute demo video explaining implementation, limitations, and future improvements.
- A presentation deck (product overview, key features, value proposition).
- Git repository with the implementation (this repo).
- Technical documentation published on GitHub Pages (team addition, not in the brief):
  - Technical overview: context, features
  - High-level architecture: C4 L1 Context, L2 Container, L3 Component, Deployment diagrams
  - Detailed architecture per module (Product Website, Patient, Doctor, Admin): module overview,
    L2 container view, data model
  - API documentation: Swagger / OpenAPI
  The L2 Container diagram must stay consistent with the brief's Figure 1 (Web Application →
  REST/JSON → Backend API [NestJS + Prisma] → PostgreSQL, inside a "runtime-owned containers only"
  boundary).

## Spec-driven workflow (OpenSpec)

Features are built through OpenSpec (`@fission-ai/openspec`, pinned as a workspace devDependency):

- `openspec/specs/<capability>/spec.md` is the source of truth for current behavior;
  `openspec/config.yaml` holds project context and rules for generated artifacts.
- Each build phase is one change in `openspec/changes/<change-id>/` (proposal, spec deltas,
  design, tasks): `/opsx:propose` → human review → `/opsx:apply` → tests pass → `/opsx:archive`
  (merges deltas into `openspec/specs/`). Don't write feature code without an approved change.
- Every `#### Scenario` in a spec should map to a test; name tests after their scenarios.
- Tooling/docs-only changes set `skip_specs: true` in the change's `.openspec.yaml`.
- Run `pnpm exec openspec validate` before committing spec or change edits.
- One commit per change, made after it is verified and archived (code + tests + docs + archived
  change folder together). Never push unless the user asks.

## Development-tooling note

The brief specifies AI-assisted development as Opus 5 for planning / Sonnet 5 for implementation
(or Cursor Router as an alternative) — this governs how the assistant should split planning vs.
implementation work in this repo, not something to build into the app. AI tooling is
development-only and must never be called by the deployed application itself.
