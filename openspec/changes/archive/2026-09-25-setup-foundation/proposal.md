# Proposal

## Why

The repository contains only the brief. Every feature change that follows (auth, scheduling,
booking, consultations, admin) needs the same foundation first: a pnpm workspace with the
mandated stack, a database the API can migrate and reach, a one-command local stack, a typed
API contract shared with the frontend, quality gates in CI, and the technical documentation site
the team will publish to GitHub Pages. Building that once, up front, keeps each feature change
focused on behavior.

## What Changes

- Create the pnpm workspace: `apps/api` (NestJS + Prisma), `apps/web` (React + Vite SPA),
  `packages/api-client` (generated OpenAPI types + typed fetch client), and `docs` (VitePress).
- Shared tooling: strict TypeScript base config, ESLint, Prettier, root scripts for dev, build,
  lint, typecheck, test, OpenAPI generation, and docs.
- API platform concerns every later module relies on: validated environment configuration,
  structured request logging with request IDs, a consistent JSON error format (including mapping
  database constraint violations), a public health endpoint, and Swagger/OpenAPI documentation.
- Database baseline: Prisma connected to PostgreSQL with an initial migration that enables the
  `btree_gist` extension needed for appointment-overlap exclusion constraints later. No domain
  tables yet; each feature change adds its own.
- Web baseline: routing, data-fetching client, Tailwind + shadcn/ui setup, and a system-status
  page that proves browser → nginx → API → database wiring end to end.
- Docker Compose stack (PostgreSQL, API, web via nginx) that starts with a single command and
  default configuration, plus a database-only compose file for local development.
- GitHub Actions: CI (lint, typecheck, unit/e2e tests, build, generated-client freshness check,
  OpenSpec validation) and a docs workflow that deploys the VitePress site to GitHub Pages.
- Documentation site skeleton matching the team's checklist, with the C4 L1 Context, L2
  Container, and Deployment diagrams written now; L3 and per-module pages scaffolded for later
  changes to fill.

No external SaaS, BaaS, or runtime API is introduced. All new dependencies are open-source
libraries or container images run locally.

**Product modules affected:** none functionally. This is shared infrastructure for Product
Website, Patient, Doctor, and Admin.

## Capabilities

### New Capabilities
- `local-deployment`: Running the full application locally: single-command startup, automatic
  database migration, health reporting, same-origin API routing through the web entrypoint,
  consistent API error responses, and the self-contained runtime guarantee.
- `technical-documentation`: The published technical documentation site: required structure,
  diagrams maintained as text, an API reference generated from the implementation, and
  automated publishing to GitHub Pages.

### Modified Capabilities
<!-- None: no specs exist yet. -->

## Impact

- New code: `apps/api`, `apps/web`, `packages/api-client`, `docs`, `.github/workflows`,
  `docker-compose.yml`, `docker-compose.dev.yml`, root configs, `README.md`.
- New public HTTP surface: `GET /api/health`, `GET /api/docs` (Swagger UI), `GET /api/docs-json`.
- Local ports: web `8080`, API `3000`, PostgreSQL `5432` (dev compose only), Vite dev `5173`.
- `CLAUDE.md` gains the real development commands once they exist.
