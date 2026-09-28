# Hey Doc

A prototype telehealth web application: a public product website plus Patient, Doctor, and Admin
experiences, built as a standalone stack with no external SaaS/BaaS/runtime dependencies. See
`CLAUDE.md` for the full product brief and constraints.

## Prerequisites

- [Docker](https://www.docker.com/) with Compose v2+ (for the quick start)
- [Node.js](https://nodejs.org/) 24+ and [pnpm](https://pnpm.io/) 12.6.0 (for local development
  outside containers)

## Docker quick start

From a fresh clone, with no `.env` file required:

```bash
docker compose up --build
```

This starts PostgreSQL, the NestJS API, and the web app (nginx serving the built SPA and
proxying `/api` and `/socket.io` to the API). Once healthy:

- Web app: <http://localhost:8080>
- Sign in / register: <http://localhost:8080/login>, `/register/patient`, `/register/doctor`
- System status page: <http://localhost:8080/status>
- API health: <http://localhost:8080/api/health>
- Swagger UI: <http://localhost:8080/api/docs>

The API entrypoint provisions a default administrator on first startup (never overwritten on
restart): **admin@telehealth.local** / **ChangeMe-Admin-2026**. These are local-only defaults —
see [Configuration](#configuration) to change or disable them.

It also loads a fictional demo dataset on first startup (`DEMO_DATA=true` by default) — populated
doctors, patients, appointments, and notifications, so there's something to explore immediately.
Sign in as the primary demo patient (`patient@demo.telehealth.local`) or doctor
(`doctor@demo.telehealth.local`), both with password `Demo-Password-2026`. See the
[Demo guide](docs/guide/demo.md) for the full account list, what's in the dataset, and how to
stage a live consultation for a recording.

Stop the stack with `docker compose down` (data persists in a named volume); add `-v` to also
remove the volume and start from an empty database next time.

## Local development

Run the app natively on the host with a database-only container:

```bash
pnpm install
pnpm db:up             # starts Postgres on localhost:5432 (docker-compose.dev.yml)
cp apps/api/.env.example apps/api/.env
set -a; source apps/api/.env; set +a   # standalone scripts don't load .env themselves — see below
pnpm db:migrate        # applies migrations, then provisions the admin from the exported vars
pnpm dev               # runs the API (http://localhost:3000) and web (http://localhost:5173)
```

`pnpm dev` proxies `/api` and `/socket.io` from the Vite dev server to the API, so the web app
behaves the same as it does behind nginx. Stop the database container with `pnpm db:down`.

`apps/api/.env.example` includes `ADMIN_EMAIL`/`ADMIN_PASSWORD`; `pnpm db:migrate` runs the admin
provisioning script after migrating, so a native `pnpm dev` setup gets the same default
administrator account as the Docker quick start — but that script, like the demo-seed scripts
below, reads `process.env` directly rather than loading `apps/api/.env` itself (only `prisma.config.ts`
does that), so the variables must actually be exported in the shell first (the `source` line
above), not just present in the file. Leave `ADMIN_EMAIL`/`ADMIN_PASSWORD` unset (don't export
them) to skip provisioning entirely.

## Configuration

Every setting below has a working default — `docker compose up --build` needs no `.env` file.
Override them via `.env` at the repo root (Docker) or `apps/api/.env` (native `pnpm dev`); see
`.env.example` / `apps/api/.env.example` for the full list with defaults.

| Setting                   | Default                                             | Notes                                                                             |
| -------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `APP_ORIGINS`               | `http://localhost:8080,http://localhost:5173`         | Comma-separated allow-list for the Origin check on state-changing requests         |
| `COOKIE_SECURE`             | `false`                                               | Set `true` when serving over HTTPS, so the session cookie requires TLS             |
| `SESSION_IDLE_MINUTES`      | `120`                                                 | A session stops working after this long without activity                          |
| `SESSION_ABSOLUTE_HOURS`    | `12`                                                  | ...or this long after sign-in, whichever comes first                              |
| `ADMIN_EMAIL`/`ADMIN_PASSWORD` | `admin@telehealth.local` / `ChangeMe-Admin-2026` | The pre-provisioned administrator; **change these for anything beyond local dev.** Unset both to skip provisioning |
| `DEMO_DATA`                 | `true` (Docker Compose only; `false` otherwise)       | Loads the fictional demo dataset after migrations and admin provisioning. See the [Demo guide](docs/guide/demo.md) |
| `JITSI_ROOM_SECRET`          | `dev-only-change-me`                                  | Derives each appointment's video-call room name. **Change this for anything beyond local dev.** See [Known deviations](#known-deviations) |

See `docs/architecture/auth.md` (published on the docs site as "Authentication &
Authorization") for the session model and protections these settings control.

## Known deviations

This project's [standalone-runtime rule](CLAUDE.md) (no external SaaS/BaaS for any core
feature) has one deliberate, documented exception: **the consultation workspace's video call
uses Jitsi's public `meet.jit.si` server**, embedded client-side. This is a prototype-only
choice — real (if fictional) patient/doctor audio and video transits a third-party server with
no uptime guarantee, which would be unacceptable in a real deployment. Every other feature
(auth, matching, notifications, records, scheduling) remains fully self-contained in this
stack. See the `consultation-session` spec's "Video" requirement (`openspec/specs/`) and the
`add-consultation-video` change for the full rationale.

### Running a single test

```bash
# One API unit test file
pnpm --filter api run test -- src/config/env.schema.spec.ts

# One API test by name (unit or e2e)
pnpm --filter api run test -t "Missing database URL"
pnpm --filter api run test:e2e -t "Database unreachable"

# One web test file
pnpm --filter web exec vitest run src/routes/status.test.tsx

# One browser (Playwright) test file, against a running e2e stack (see "Browser tests" below)
pnpm --filter e2e exec playwright test tests/journey.spec.ts
```

## Browser tests

An automated Playwright suite runs the full core journey (registration through consultation and
records) and cross-cutting checks (no third-party requests, no horizontal scroll at 360px, basic
accessibility) against the real containerized stack — nginx, the CSP, and the actual container
entrypoints, not `pnpm dev`. It needs its own stack, started with an override that publishes a
throwaway Postgres and disables demo data and auth rate limiting:

```bash
docker compose -f docker-compose.yml -f docker-compose.e2e.yml up --build -d
# wait for it to report healthy: curl -sf http://localhost:8080/api/health
pnpm exec playwright install --with-deps chromium   # once, or whenever Playwright is upgraded
pnpm test:browser
docker compose -f docker-compose.yml -f docker-compose.e2e.yml down -v
```

See [Testing & Quality](docs/architecture/testing.md) for the full test pyramid, the
scenario-to-test naming convention, the traceability check (`pnpm traceability`), and the
manual-verification register.

## Scripts

Run from the repository root unless noted otherwise.

| Script                  | Description                                                          |
| ----------------------- | -------------------------------------------------------------------- |
| `pnpm dev`              | Run the API and web dev servers together                             |
| `pnpm build`            | Build the API and web app                                            |
| `pnpm lint`             | Lint every package                                                   |
| `pnpm typecheck`        | Typecheck every package                                              |
| `pnpm test`             | Run unit tests in every package                                      |
| `pnpm test:e2e`         | Run the API's e2e tests (builds the API, migrates `telehealth_test`) |
| `pnpm test:browser`     | Run the Playwright suite (needs the e2e stack running — see above)   |
| `pnpm test:scripts`     | Run `scripts/*.test.mjs` with Node's built-in test runner            |
| `pnpm traceability`     | Check every spec scenario has a matching test or register entry      |
| `pnpm demo:seed`        | Seed the demo dataset (native dev; no-ops if already present)        |
| `pnpm demo:live`        | Stage a live consultation 10 minutes out, for a recording            |
| `pnpm demo:reset`       | Remove all demo accounts and their data; leaves everything else      |
| `pnpm format`           | Format the repo with Prettier                                        |
| `pnpm openapi:generate` | Regenerate the OpenAPI document and the typed API client             |
| `pnpm docs:generate-data-model` | Regenerate the full ER diagram from `schema.prisma`           |
| `pnpm docs:dev`         | Run the documentation site locally with live reload                  |
| `pnpm docs:build`       | Build the documentation site                                         |
| `pnpm db:up`            | Start the local Postgres-only container (`docker-compose.dev.yml`)   |
| `pnpm db:down`          | Stop it                                                              |
| `pnpm db:migrate`       | Apply Prisma migrations to it                                        |

## Repository layout

```
apps/api             NestJS + Prisma REST API (includes apps/api/scripts/seed-demo.ts)
apps/web              React + Vite SPA (product website, Patient, Doctor, Admin)
packages/api-client   Generated OpenAPI types + typed fetch client, shared by apps/web
e2e                    Playwright browser test suite, against the containerized stack
docs                   VitePress technical documentation site
scripts                Repo-wide tooling (the scenario-to-test traceability check)
openspec               Spec-driven change workflow (proposals, specs, design, tasks)
docker-compose.yml     Full local stack (postgres, api, web)
docker-compose.dev.yml Postgres-only, for running api/web natively on the host
docker-compose.e2e.yml Override for the browser test suite (layer on top of docker-compose.yml)
```

## Spec-driven workflow (OpenSpec)

Features are built through OpenSpec (`@fission-ai/openspec`, a pinned workspace devDependency):

```bash
export OPENSPEC_TELEMETRY=0
pnpm exec openspec validate --all --strict
```

`openspec/specs/<capability>/spec.md` holds the current behavior; each build phase lives in
`openspec/changes/<change-id>/` (proposal, spec deltas, design, tasks) and is proposed, applied,
and archived through the `/opsx:*` slash commands. See `CLAUDE.md` for the full workflow.

## Documentation site

The technical documentation (`docs/`) covers the architecture (C4 diagrams), per-module design,
and the API reference (generated from the API's own OpenAPI document — `pnpm docs:build` copies
it in automatically). Preview it locally with `pnpm docs:dev`.

### GitHub Pages setup (one-time, manual)

1. Push this repository to GitHub.
2. In the repository's **Settings → Pages**, set **Source** to **GitHub Actions**.
3. Push to `main` (or run the "Deploy Docs" workflow manually) — `.github/workflows/docs.yml`
   builds `docs/` with `DOCS_BASE` set to the repository's subpath and deploys it.
