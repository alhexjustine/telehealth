# Design

## Context

All feature changes are complete by the time this change starts: authentication, availability,
discovery, booking, notifications, consultations and records, the admin console, and the product
website.

- **Stack:** Docker Compose runs Postgres, the API (the entrypoint runs migrate, then
  provision-admin, then start), and web behind nginx with a CSP.
- **API tests:** e2e tests use Jest + supertest against `telehealth_test`.
- **Web tests:** Vitest.
- **Scenario-named tests:** tests are already named after scenarios, following the project rules.

If implemented names differ, adapt to the real code. The requirements are in
`specs/demo-data`, `specs/ui-resilience`, `specs/journey-verification`, and the modified
`specs/local-deployment`.

## Goals / Non-Goals

**Goals:**
- A reviewer can clone the repo, run one command, and explore a believable, populated product.
- The presenter can stage a live consultation in one command before recording the video.
- One mechanical check backs the claim that every scenario is tested.

**Non-Goals:**
- Load and performance testing, visual regression, and cross-browser matrices (Chromium only).
- New feature behavior.
- Deploying anywhere other than local Compose. Cloud deployment is an optional bonus in the brief,
  and out of scope here.

## Decisions

### Seed script design
`apps/api/scripts/seed-demo.ts` has three modes:
- default: seed if absent
- `--live-consultation`
- `--reset`

It uses the Prisma client directly inside transactions, and a fixed PRNG seed for names and
choices, so runs are reproducible. Times are computed relative to `now`, in each doctor's time
zone.

- **Presence check:** the demo dataset counts as present if a user with the reserved primary
  patient email (`patient@demo.telehealth.local`) exists. In that case the default mode exits
  without changes.
- **Accounts:** passwords are hashed with the application's own password hasher. The shared
  password is `Demo-Password-2026`, documented in the README and the demo guide.
- **Appointment status:** past appointments are inserted directly with their final status.
  Completed ones get sessions, notes, and prescriptions.
- **Upcoming appointments:** these are chosen from `generateSlots` output for the target doctor,
  so they are valid and consistent with availability, and the exclusion constraints still hold.
- **Rescheduled pair:** a cancelled original plus a booked successor linked through
  `rescheduledFromId`.
- **Invalid bookings:**
  - `NOT_COMPLETED`: an appointment that ended 2 hours ago and is still `BOOKED`.
  - `DOCTOR_UNAVAILABLE`: an upcoming appointment with the rejected doctor, inserted before the
    rejection is recorded.
- **Notifications:** a few rows using the existing types and link formats.
- **Audit entries:** written with `AuditService.record` for the implied approvals, the rejection,
  and the suspensions. The actor is the provisioned admin.
- **Container startup:** the entrypoint runs `seed-demo` after `provision-admin` when
  `DEMO_DATA=true`. Compose defaults to `true`, and `.env.example` documents it. A missing or
  false value means no seeding. CI and tests leave it unset.
- **Local commands:**
  - `pnpm --filter api run demo:seed`
  - `pnpm demo:live` (root script, for local dev)
  - `docker compose exec api node dist/scripts/seed-demo.js --live-consultation` (for the
    containerized stack, documented)

*Rejected:* seeding through the HTTP API. It would need a running server, and it can't create
past data because of the booking rules.

*Rejected:* static SQL fixtures. Their times would go stale.

### Live consultation
This mode deletes the previous staged appointment and its session, note, and prescriptions, all
cascading. The staged appointment is identified by a reserved reason prefix `[demo-live]` and the
demo pair.

It then inserts a `BOOKED` appointment starting at `now + 10 min`, lasting the demo doctor's
consultation length. If that overlaps another booked appointment of the pair, it shifts forward
in steps of the consultation length.

### Reset
Reset deletes users whose email ends with `@demo.telehealth.local`, with cascades covering
profiles, sessions, appointments, notifications, and records. It first deletes the appointments
where either participant is a demo user, in case a non-demo user booked with a demo doctor, so
that no foreign keys fail.

Audit entries are append-only and are kept. They reference entity IDs without foreign keys, and
the actor is the non-demo admin. The docs state this explicitly.

### UI resilience primitives
- **`QueryState`:** a component, or a render helper, that takes a TanStack Query result and
  render functions for loading, empty, error, and data. The error view shows a message mapped
  from the error `code` and status, plus a Retry button that calls `refetch`.
- **Background refresh failures:** when data already exists and a refetch fails, a small inline
  notice appears instead of the error view.
- **Migration:** every existing data view is migrated to `QueryState`. A test asserts that each
  route's main query uses it. At minimum, cover the list and detail pages of every module.
- **Error boundary:** a React Router `errorElement` at the root and at each role layout renders
  `RecoveryPage` (Reload, plus a Home link resolved from the current user), and logs the error
  with `console.error`.
- **Session-ended flow:** the existing api-client 401 handler sets a `sessionEnded` flag in
  `sessionStorage` before redirecting to `/login?returnTo=…`. The sign-in page shows the message
  once, then clears the flag.

### Browser test package
`e2e/` is a workspace package with `@playwright/test`, `@axe-core/playwright`, and `pg` (a
test-only database helper).

`docker-compose.e2e.yml` is an override that:
- publishes Postgres on `5433`
- sets `DEMO_DATA=false`
- sets a fixed admin password for tests
- disables the auth rate limits via a test-only env flag (`THROTTLE_DISABLED=true`), which the
  API honors only when set explicitly. Otherwise sign-in throttling would slow multi-user flows.

Fixtures cover:
- one browser context per role
- the admin sign-in
- a DB helper that moves a given appointment's `starts_at`/`ends_at` into the join window, the one
  deliberate test-harness shortcut; it is documented in the test and on the testing page
- unique emails per run

Tests:
- `journey.spec.ts`: the spec's core journey. The doctor's page stays open in a second context
  to assert that the live notification toast appears.
- `no-third-party.spec.ts`: records `page.on('request')` origins across the landing, sign-in, and
  registration pages, plus one role home page.
- `responsive.spec.ts`: a 360px viewport, asserting
  `document.documentElement.scrollWidth <= innerWidth`.
- `a11y.spec.ts`: `AxeBuilder` on the listed pages, failing on serious or critical violations.

The CI job builds and starts the stack with both compose files, waits for `/api/health`, runs
`npx playwright install --with-deps chromium` and then the tests, uploads the HTML report as an
artifact, and tears the stack down.

*Rejected:* running the browser tests against `pnpm dev`. That doesn't exercise nginx, the CSP,
or the container entrypoints, which are exactly the integration risks.

### Traceability check
`scripts/check-traceability.mjs` works as follows:
1. Parse every `openspec/specs/*/spec.md` for `#### Scenario: <title>` under its capability.
2. Collect the test titles by scanning test sources for `it(`, `test(` and `describe(` string
   literals in `apps/api/{src,test}`, `apps/web/src`, and `e2e/`.
3. A scenario passes if some test title contains its exact title, case-insensitive. Scenario
   titles that repeat across capabilities (for example "Signed-out denied") must include a
   capability qualifier. The check accepts the title plus a parenthesized qualifier, such as
   `Signed-out denied (appointments)`, and requires one match per capability occurrence.
4. The register `openspec/manual-verification.md` lists `capability / scenario — how verified —
   why not automated` entries, parsed as a table.
5. Output the missing scenarios grouped by capability, and exit 1 if any are missing.

The script runs in CI after the unit tests. Initial gaps found by the first run are either fixed
by adding the missing tests, or registered with a justification. Candidate registrations include
the offline-operation and push-to-main scenarios. The register is expected to stay short.

*Rejected:* annotating each test with scenario IDs. The title convention already exists
project-wide, and IDs would duplicate it.

## Risks / Trade-offs

- [Scenario titles are not unique across capabilities] → The qualifier rule above makes matching
  unambiguous. The check reports ambiguous matches as errors so they get fixed.
- [The Playwright browser download needs network access in CI] → This is development tooling
  only, and it's documented as not part of the runtime.
- [The DB time-shift helper in the journey test bypasses booking rules] → It's limited to the
  join-window step. The booking itself goes through the UI and the real rules first.
- [Seed code drifts from domain rules] → The seed reuses `generateSlots`, the password hasher, and
  `AuditService`. An e2e test runs the seed against the test database and then runs selected
  invariants: the exclusion constraints hold, every demo doctor is approved or has the intended
  status, and the counts match the spec.
- [The demo password is public] → It applies only to the reserved demo domain, in a fictional
  local prototype, and the README warns about it.

## Migration Plan

No schema changes. The container entrypoint gains the conditional seed step.

## Documentation impact

- New `docs/guide/demo.md`: the demo accounts table, what's in the dataset, the live-consultation
  command, the reset command, and a suggested video walkthrough order mapped to the brief's
  evaluation criteria.
- New `docs/architecture/testing.md`: the test pyramid (unit, API e2e, web component, browser
  journey), the scenario-to-test convention and the traceability check, the manual-verification
  register, and the test-harness shortcuts.
- `README.md`: a quick start with demo credentials, the demo commands, and how to run the browser
  tests.
- `CLAUDE.md`: the browser-test and traceability commands, and the `QueryState` convention for new
  views.
- Navigation updated. Every module page's "planned" labels are removed or confirmed.
