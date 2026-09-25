# Design

## Context

Greenfield repository: only the brief, `CLAUDE.md`, the OpenSpec setup, and a root
`package.json` / `pnpm-workspace.yaml` (workspace globs `apps/*`, `packages/*`, `docs`) exist.
Local toolchain: Node 26, pnpm 12.6, Docker 29 with Compose v5. The stack is fixed by the brief
(see `openspec/config.yaml` context). Specs: `specs/local-deployment`, `specs/technical-documentation`.

## Goals / Non-Goals

**Goals:**
- Every later change can add a NestJS module, Prisma models, web routes, and docs pages without
  touching build, container, or CI plumbing.
- The typed contract between API and web is generated, never hand-written.
- `docker compose up --build` works on a clean machine with no `.env`.

**Non-Goals:**
- Any domain model, authentication, or role-based UI (next change: `add-authentication`).
- socket.io gateway implementation (only the nginx upgrade path is prepared now).
- Seed data, Playwright end-to-end suite, and the landing page (later changes).
- Cloud deployment of the application.

## Decisions

### Workspace layout
`apps/api`, `apps/web`, `packages/api-client`, `docs`, all TypeScript strict, extending a root
`tsconfig.base.json`. Root scripts fan out with `pnpm -r` / `--filter`. Rejected: Turborepo/Nx —
extra tooling with no payoff at four packages.

### Runtime versions
Node 24 LTS in containers and CI (`.nvmrc` = 24, `engines.node >= 24`); PostgreSQL 17
(`postgres:17-alpine`). pnpm version comes from the root `packageManager` field; containers
install that exact version with `npm i -g pnpm@<version>` rather than corepack (corepack is no
longer bundled with newer Node releases). Use the latest stable major of each library
(NestJS, Prisma, Vite, React, React Router, TanStack Query, Tailwind, VitePress) and follow the
installed version's own documentation — several have recent breaking changes (notably Prisma's
newer `prisma.config.ts` + `prisma-client` generator + driver adapter setup, Tailwind v4's Vite
plugin setup, and React Router's unified `react-router` package).

### API platform
- Global prefix `/api`; port from config (default 3000).
- Config: `@nestjs/config` with a zod schema validated at boot (`DATABASE_URL` required,
  `PORT`, `NODE_ENV`, `LOG_LEVEL`). Fails fast with the missing key named.
- Logging: `nestjs-pino`; `genReqId` reuses `X-Request-Id` or generates a UUID and echoes it
  in the response header. Pretty output only when `NODE_ENV=development`.
- Errors: one global exception filter producing `{ statusCode, error, message, requestId }`.
  Maps Prisma `P2002` (unique) and PostgreSQL `23P01` (exclusion violation, surfaced through
  Prisma) → 409, `P2025` → 404; everything unknown → 500 with a generic message, logged with
  the stack. Rejected: per-controller try/catch — inconsistent and repetitive.
- Security headers via `helmet`, configured so Swagger UI still loads.
- Health: `@nestjs/terminus` with a Prisma ping (`SELECT 1`) indicator at `GET /api/health`,
  returning 503 when the database is down. Excluded from Swagger auth later.
- Swagger via `@nestjs/swagger` at `/api/docs` (UI) and `/api/docs-json`. The OpenAPI document
  is built by a shared function used both at runtime and by the generation script.

### Database access
`PrismaService` wraps the generated client using the PostgreSQL driver adapter and connects
lazily (no eager connect in `onModuleInit`), so the app can boot for OpenAPI generation and the
health check can report "down" instead of crashing when the DB is unavailable. The first
migration contains only `CREATE EXTENSION IF NOT EXISTS btree_gist;`. The schema has no models
yet. Rejected: declaring the full data model now — each feature change owns its tables, which
keeps OpenSpec deltas honest.

### OpenAPI → typed client
`apps/api/scripts/generate-openapi.ts` creates the Nest app (no `listen`, no DB access), writes
`packages/api-client/openapi.json`, then `openapi-typescript` writes
`packages/api-client/src/schema.d.ts`. `packages/api-client/src/index.ts` exports
`createApiClient(baseUrl = '/api')` built on `openapi-fetch` with `credentials: 'include'`.
Generated files are committed; CI regenerates and fails on `git diff --exit-code`.
Rejected: shared zod package — two sources of truth with the Nest DTOs; Orval/openapi-generator —
heavier generated code for no gain.

### Web baseline
Vite + React + TypeScript, `@/` path alias, Tailwind v4 via its Vite plugin, shadcn/ui
initialized (`components.json`, `cn` util, base theme tokens), React Router (library/data mode),
TanStack Query `QueryClientProvider`. Routes now: `/` placeholder shell and `/status` showing API
+ database health via the api-client. Vite dev server proxies `/api` and `/socket.io` to
`http://localhost:3000`, mirroring nginx so code is identical in dev and containers.

### Containers
- `apps/api/Dockerfile`: multi-stage; build with the workspace, produce a pruned production
  deployment (`pnpm deploy --filter api --prod`), run as non-root. Entrypoint runs
  `prisma migrate deploy` then starts the server. Healthcheck calls `/api/health`.
- `apps/web/Dockerfile`: multi-stage; Vite build → `nginx:alpine` with `nginx.conf` that
  serves static files with SPA fallback (`try_files $uri /index.html`), proxies `/api/` and
  `/socket.io/` (with `Upgrade`/`Connection` headers) to `api:3000`.
- `docker-compose.yml`: `postgres` (named volume, `pg_isready` healthcheck) → `api`
  (`depends_on: service_healthy`) → `web` (published on `8080`). Every variable has an inline
  default (`${POSTGRES_PASSWORD:-telehealth}`) so no `.env` is required; `.env.example`
  documents them. Postgres is not published to the host in this file.
- `docker-compose.dev.yml`: Postgres only, published on `5432`, with an init script creating a
  second `telehealth_test` database for e2e tests.

### Testing
API: Jest (NestJS default) for unit tests and supertest e2e tests against a real Postgres
(`telehealth_test`); an e2e test for the database-down scenario points the app at an unreachable
host. Web: Vitest + Testing Library + jsdom. Test names quote the spec scenario names.
Rejected: Vitest for the API — requires SWC plugin setup for decorator metadata; Jest is Nest's
supported path.

### Linting and formatting
Root ESLint flat config with `typescript-eslint` (type-aware), `eslint-plugin-react-hooks` and
`eslint-plugin-react-refresh` for web; Prettier at root; `.editorconfig`.

### CI/CD
`.github/workflows/ci.yml` on push and pull request: install (frozen lockfile) → lint →
typecheck → OpenAPI regenerate + diff check → unit tests → e2e tests (Postgres service
container) → build → `openspec validate` (all changes and specs, strict).
`.github/workflows/docs.yml` on push to `main` and manual dispatch: build docs with
`DOCS_BASE=/<repo-name>/` → `actions/upload-pages-artifact` → `actions/deploy-pages`.
Repository settings must have Pages source set to "GitHub Actions" (manual, documented in README).

### Documentation site
VitePress in `docs/` with a Mermaid plugin (build fails on invalid diagrams). `base` comes from
`DOCS_BASE` (default `/`). Swagger UI is rendered client-side by a small Vue component loading
`openapi.json`, which a `predocs` script copies from `packages/api-client` into `docs/public/`.
Pages:
- `index.md` — Technical Overview: Context, Features (features listed with planned/done status).
- `architecture/c4-context.md` — L1 (written now).
- `architecture/c4-container.md` — L2 (written now; mirrors brief Figure 1 plus WebSocket edge).
- `architecture/c4-component.md` — L3 with the foundation components (config, logging, error
  filter, Prisma, health, Swagger) and planned feature modules marked as planned.
- `architecture/deployment.md` — Compose topology, ports, volumes, healthchecks (written now).
- `modules/{product-website,patient,doctor,admin}.md` — Module Overview / L2 Container view /
  Data Model headings, each marked planned with the change that completes it.
- `api/index.md` — Swagger UI.
Mermaid C4 diagrams are experimental; if a C4 diagram renders poorly, fall back to a Mermaid
flowchart styled with C4 conventions (person/container/boundary labels). Rejected: Structurizr
or PlantUML — require Java/Docker at docs build time.

## Risks / Trade-offs

- [Library major versions newer than training data] → Implementer checks installed versions and
  their docs; every scenario is verified by running it, not assumed.
- [Mermaid C4 layout quality] → Flowchart fallback described above.
- [pnpm deploy in Docker with workspace packages] → Verify the API image starts and migrates in
  an actual `docker compose up --build`.
- [Swagger UI blocked by helmet CSP] → Configure CSP for the docs route and verify `/api/docs`
  renders.
- [Offline scenario hard to automate] → Verified manually once (network-disabled run) and
  recorded in the task.

## Migration Plan

Not applicable (first change). Rollback is deleting the working-tree changes; nothing is
committed by this change.

## Documentation impact

Creates the `docs/` site. Written now: Technical Overview, C4 L1, C4 L2, Deployment, API page.
Scaffolded for later changes: C4 L3 feature components, all four module pages.
