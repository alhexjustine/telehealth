# Tasks

## 1. Demo data

- [x] 1.1 Implement `seed-demo.ts` default mode (presence check, reproducible PRNG, accounts, doctors with schedules incl. one different time zone, patients incl. minor/incomplete/suspended, appointments in every state with notes and prescriptions, invalid bookings, notifications, audit entries) reusing the password hasher, `generateSlots`, and `AuditService`; e2e tests "Doctor search is populated", "Records are populated", "Admin has work to do", and an invariants test (exclusion constraints hold, counts meet the spec)
- [x] 1.2 Wire `DEMO_DATA` into the docker entrypoint, compose defaults, `.env.example`, and env validation; verify "First startup loads demo data", "Restart leaves demo data unchanged", "Disabled", and "Ready to explore" via `docker compose down -v && docker compose up --build`
- [x] 1.3 Implement `--live-consultation` and `--reset` and root/API scripts; e2e/script tests "Stage a live consultation", "Run twice", "Reset keeps real data"

## 2. UI resilience

- [x] 2.1 Build `QueryState` with code-aware error messages, retry, and the background-refresh notice; Vitest tests "Request fails", "Background refresh fails", "Empty list"
- [x] 2.2 Migrate every data view in all four modules to `QueryState` and add the check that each route's main query uses it; verify the web test suite passes
- [x] 2.3 Add root and role-layout error boundaries with `RecoveryPage`; Vitest test "Component crashes"
- [x] 2.4 Add the session-ended flag and sign-in message; Vitest test "Session expires while browsing"

## 3. Browser tests

- [x] 3.1 Create the `e2e/` package, `docker-compose.e2e.yml` (published Postgres, demo data off, test-only throttle flag honored only when set), fixtures, and the DB time-shift helper; verify `pnpm --filter e2e test` runs a smoke test against the stack
- [x] 3.2 Write `journey.spec.ts` covering the full core journey; browser test "Journey passes"
- [x] 3.3 Write `no-third-party.spec.ts`, `responsive.spec.ts`, and `a11y.spec.ts`; browser tests "Third-party request detected" (assert the check logic flags an injected cross-origin request in a fixture page) and "Narrow viewport", plus the product-website scenario "No third-party requests at runtime"
- [x] 3.4 Add the CI job (build and start with both compose files, wait for health, install Chromium, run, upload report, tear down); verify locally by running the same commands in order, and verify "Journey failure fails CI" by temporarily breaking one assertion and confirming a non-zero exit (then revert)

## 4. Traceability

- [x] 4.1 Implement `scripts/check-traceability.mjs` with the qualifier rule and register parsing, plus `openspec/manual-verification.md`; tests "Missing test" and "Registered manual scenario" against fixture specs
- [x] 4.2 Run it against the real specs, fix gaps by adding or renaming tests (preferred) or registering justified manual scenarios; wire it into CI; verify it passes

## 5. Documentation

- [x] 5.1 Write `docs/guide/demo.md` and `docs/architecture/testing.md`, update navigation, remove stale "planned" labels across module pages, update `README.md` and `CLAUDE.md`; verify `pnpm docs:build` passes and every documented command runs as written

## 6. Integration check

- [x] 6.1 From a clean state run lint, typecheck, unit, e2e, build, `check:assets`, traceability, docs build, generated-file freshness checks, `openspec validate --all --strict`, `docker compose down -v && docker compose up --build` with demo data, and the full browser suite against the e2e stack; confirm all pass
