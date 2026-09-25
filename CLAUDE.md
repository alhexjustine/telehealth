# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

The `setup-foundation` change has scaffolded the workspace: `apps/api` (NestJS + Prisma),
`apps/web` (React + Vite SPA), `packages/api-client` (generated OpenAPI client), and `docs`
(VitePress). No domain features (auth, matching, booking, consultations, admin) exist yet — see
`openspec/changes/` for what's in flight.

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

## Development-tooling note

The brief specifies AI-assisted development as Opus 5 for planning / Sonnet 5 for implementation
(or Cursor Router as an alternative) — this governs how the assistant should split planning vs.
implementation work in this repo, not something to build into the app. AI tooling is
development-only and must never be called by the deployed application itself.
