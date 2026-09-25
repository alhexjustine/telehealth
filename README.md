# Telehealth

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
- System status page: <http://localhost:8080/status>
- API health: <http://localhost:8080/api/health>
- Swagger UI: <http://localhost:8080/api/docs>

Stop the stack with `docker compose down` (data persists in a named volume); add `-v` to also
remove the volume and start from an empty database next time.

## Local development

Run the app natively on the host with a database-only container:

```bash
pnpm install
pnpm db:up             # starts Postgres on localhost:5432 (docker-compose.dev.yml)
cp apps/api/.env.example apps/api/.env
pnpm db:migrate        # applies migrations to the `telehealth` database
pnpm dev               # runs the API (http://localhost:3000) and web (http://localhost:5173)
```

`pnpm dev` proxies `/api` and `/socket.io` from the Vite dev server to the API, so the web app
behaves the same as it does behind nginx. Stop the database container with `pnpm db:down`.

### Running a single test

```bash
# One API unit test file
pnpm --filter api run test -- src/config/env.schema.spec.ts

# One API test by name (unit or e2e)
pnpm --filter api run test -t "Missing database URL"
pnpm --filter api run test:e2e -t "Database unreachable"

# One web test file
pnpm --filter web exec vitest run src/routes/status.test.tsx
```

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
| `pnpm format`           | Format the repo with Prettier                                        |
| `pnpm openapi:generate` | Regenerate the OpenAPI document and the typed API client             |
| `pnpm docs:dev`         | Run the documentation site locally with live reload                  |
| `pnpm docs:build`       | Build the documentation site                                         |
| `pnpm db:up`            | Start the local Postgres-only container (`docker-compose.dev.yml`)   |
| `pnpm db:down`          | Stop it                                                              |
| `pnpm db:migrate`       | Apply Prisma migrations to it                                        |

## Repository layout

```
apps/api             NestJS + Prisma REST API
apps/web              React + Vite SPA (product website, Patient, Doctor, Admin)
packages/api-client   Generated OpenAPI types + typed fetch client, shared by apps/web
docs                   VitePress technical documentation site
openspec               Spec-driven change workflow (proposals, specs, design, tasks)
docker-compose.yml     Full local stack (postgres, api, web)
docker-compose.dev.yml Postgres-only, for running api/web natively on the host
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
