# Tasks

## 1. Workspace and tooling

- [x] 1.1 Add root configs (`tsconfig.base.json` strict, `.editorconfig`, `.nvmrc` = 24, `.gitignore`, `.dockerignore`, Prettier config) and verify `pnpm exec prettier --check .` runs
- [x] 1.2 Add root ESLint flat config (typescript-eslint type-aware; react-hooks/react-refresh scoped to `apps/web`) and verify `pnpm lint` runs across the workspace once packages exist
- [x] 1.3 Add root scripts: `dev` (api + web in parallel), `build`, `lint`, `typecheck`, `test`, `test:e2e`, `format`, `openapi:generate`, `docs:dev`, `docs:build`, `db:up`, `db:down`, `db:migrate`, and verify each script resolves (`pnpm run` lists them)

## 2. API platform

- [x] 2.1 Scaffold `apps/api` NestJS app (strict TS, `/api` prefix, Jest unit + e2e configs) and verify `pnpm --filter api build` succeeds
- [x] 2.2 Add zod-validated configuration; test "Missing database URL" (process exits non-zero naming `DATABASE_URL`)
- [x] 2.3 Add `nestjs-pino` logging with request IDs; e2e tests "Client supplies a request ID" and "Client omits a request ID"
- [x] 2.4 Add the global exception filter with Prisma/PostgreSQL mappings; unit tests "Constraint violation" (P2002 and 23P01 → 409), P2025 → 404, and "Unexpected server error" (500, no stack in body); e2e test "Unknown API route"
- [x] 2.5 Add Prisma (latest, driver adapter, lazy connect), `PrismaService`, and the initial migration enabling `btree_gist`; verify `pnpm db:up && pnpm db:migrate` applies it and `SELECT extname FROM pg_extension` lists `btree_gist`
- [x] 2.6 Add `GET /api/health` with a database indicator; e2e tests "Database reachable", "Database unreachable" (503), and "No sensitive data exposed"
- [x] 2.7 Add helmet and Swagger (`/api/docs`, `/api/docs-json`) via a shared document builder; verify `/api/docs` renders in a browser or via curl returning the UI HTML and `/api/docs-json` lists `/api/health`

## 3. Generated API client

- [x] 3.1 Add `apps/api/scripts/generate-openapi.ts` writing `packages/api-client/openapi.json`; test "Generation without a database" by running `pnpm openapi:generate` with Postgres stopped
- [x] 3.2 Create `packages/api-client` (openapi-typescript → `src/schema.d.ts`, `createApiClient` on openapi-fetch with `credentials: 'include'`); verify `pnpm --filter api-client typecheck` passes and a typed call to `/health` compiles

## 4. Web baseline

- [x] 4.1 Scaffold `apps/web` (Vite + React + TS, `@/` alias, Tailwind v4, shadcn/ui init, React Router, TanStack Query) and verify `pnpm --filter web build` succeeds
- [x] 4.2 Add Vite dev proxy for `/api` and `/socket.io` to `localhost:3000`; verify `pnpm dev` serves `/api/health` through `http://localhost:5173`
- [x] 4.3 Add `/` placeholder shell and `/status` page using the api-client; Vitest tests for status page rendering healthy and unhealthy states

## 5. Containers

- [x] 5.1 Add `apps/api/Dockerfile` (multi-stage, pruned prod deploy, non-root, migrate-then-start entrypoint, healthcheck) and verify the image builds
- [x] 5.2 Add `apps/web/Dockerfile` and `apps/web/nginx.conf` (SPA fallback, `/api/` and `/socket.io/` proxy with upgrade headers) and verify the image builds
- [x] 5.3 Add `docker-compose.yml` with inline defaults and `.env.example`; verify "Fresh start with default configuration" (no `.env`, `docker compose up --build`, `curl localhost:8080/api/health` → 200) and "Empty database" (migration applied before healthy)
- [x] 5.4 Verify "API request through the web origin", "Deep link to a client-side route" (`curl localhost:8080/some/deep/link` returns the SPA HTML), and "WebSocket upgrade path" (upgrade request to `/socket.io/` reaches the API — a 400/404 from the API, not an nginx error, is acceptable until the gateway exists)
- [x] 5.5 Verify "Data survives a restart" (write a row in a scratch table via psql, `down` then `up`, row present, then drop the scratch table) and "Already migrated database" (restart logs show no migrations applied)
- [x] 5.6 Verify "Offline operation after build" by starting the built stack with networking to the internet unavailable (e.g., compose network `internal: true` override) and confirming health; record the result in the task notes
      - Result: confirmed with a temporary `internal: true` network override (not committed). Caught a real bug: `prisma generate` re-running during `pnpm deploy` tried to download the schema-engine binary from `binaries.prisma.sh` at container start, violating the self-contained-runtime rule. Fixed by making `apps/api`'s `postinstall` skip regeneration when the generated client already exists (`test -f src/generated/prisma/client.ts || prisma generate`) and dropping `--ignore-scripts` from the `pnpm deploy` step so `@prisma/engines`' own binary-download postinstall still runs normally. Re-verified healthy with no outbound network.
- [x] 5.7 Add `docker-compose.dev.yml` (Postgres on 5432 + init script creating `telehealth_test`) and verify `pnpm test:e2e` passes against it

## 6. Documentation site

- [x] 6.1 Scaffold VitePress in `docs/` with the Mermaid plugin, `DOCS_BASE`-driven `base`, and navigation for all required sections; verify `pnpm docs:build` succeeds and "All sections reachable from navigation"
- [x] 6.2 Write Technical Overview (Context, Features with planned status), C4 L1 Context, C4 L2 Container, C4 L3 Component (foundation components + planned modules), and Deployment pages; verify "Diagrams render on build" and "Container diagram matches the runtime" by inspecting the built pages, and confirm an intentionally broken diagram fails the build (then revert)
- [x] 6.3 Scaffold the four module pages with Module Overview / L2 Container view / Data Model sections labeled planned with their completing change; verify "Incomplete sections are labeled"
- [x] 6.4 Add the Swagger UI page fed by the copied `openapi.json`; verify "Reference reflects the API" (built page lists `GET /api/health`)
- [x] 6.5 Verify "Served from a repository subpath" with `DOCS_BASE=/telehealth/ pnpm docs:build` and `vitepress preview`, checking pages, assets, and the API reference load; verify "Local preview" with `pnpm docs:dev`

## 7. CI/CD

- [x] 7.1 Add `.github/workflows/ci.yml` (install, lint, typecheck, OpenAPI regen + `git diff --exit-code`, unit, e2e with Postgres service, build, `openspec validate`); verify every step's command passes locally in the same order
- [x] 7.2 Verify "Stale generated artifacts" locally: change an endpoint's path temporarily without regenerating, confirm the regen + diff step fails, then revert
- [x] 7.3 Add `.github/workflows/docs.yml` (build with `DOCS_BASE=/${{ github.event.repository.name }}/`, upload-pages-artifact, deploy-pages, correct `permissions` and `concurrency`); verify YAML parses and the build command matches task 6.5 ("Push to main" is verified after the repo is on GitHub — not yet, no GitHub remote in this environment)

## 8. Developer documentation

- [x] 8.1 Write `README.md` (overview, prerequisites, Docker quick start, local dev workflow, scripts table, repo layout, OpenSpec workflow, docs site, GitHub Pages setup step) and verify each documented command runs as written
- [x] 8.2 Replace the "Project status" note in `CLAUDE.md` with the real commands (including running a single API test and a single web test) and a short repo-layout map

## 9. Integration check

- [x] 9.1 From a clean state (`docker compose down -v`, fresh `pnpm install --frozen-lockfile`), run lint, typecheck, unit, e2e, build, docs build, `openspec validate`, and `docker compose up --build`; confirm all pass and `http://localhost:8080/status` shows API and database healthy
