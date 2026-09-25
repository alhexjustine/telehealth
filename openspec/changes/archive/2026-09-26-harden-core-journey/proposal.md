# Proposal

## Why

Every module now exists, but three gaps would hurt the evaluation and the demo:
- A fresh `docker compose up` shows an empty system, so a reviewer can't explore it without
  creating doctors, approving them, and building schedules first.
- Nothing proves the modules work together end to end in a real browser.
- The UI's behavior when things go wrong (slow responses, failed requests, expired sessions) has
  never been treated as one concern.

This change makes the prototype demo-ready and makes the "every spec scenario has a test" claim
checkable.

## What Changes

- **Demo dataset.** A realistic, fictional dataset is loaded automatically on first startup of
  the local stack. It can be turned off with configuration, and it is idempotent. It includes:
  - accounts for every role and status
  - approved doctors with schedules across specializations and time zones
  - patients, including a minor and one with an incomplete profile
  - appointments in every state: completed with notes and prescriptions, upcoming, cancelled,
    and rescheduled
  - invalid bookings for the admin to resolve
  - unread notifications and audit history
- **Demo commands.** One command creates an appointment starting in 10 minutes between the demo
  patient and the demo doctor, so the consultation workspace can be shown live at any time.
  Another removes all demo data and nothing else.
- **Resilient UI states.** Every data view has loading, empty, and error states with retry. An
  error boundary provides a recovery page. A clear "your session has ended" message appears when
  a session expires.
- **Browser verification.** An automated browser test suite (Playwright) runs against the
  containerized stack in CI. It covers:
  - the full core journey across all roles
  - no third-party requests
  - no horizontal scrolling on public pages at phone width
  - automated accessibility checks on key pages
- **Traceability check.** CI fails if any scenario in `openspec/specs` has no test named after
  it, unless the scenario is explicitly listed as manually verified with a justification.
- **Documentation.** A demo guide (demo accounts and a walkthrough script for the video), a
  testing and quality page (the test pyramid, scenario-to-test traceability), README updates,
  and final updates to `CLAUDE.md`.

No external SaaS, BaaS, or runtime API is introduced. Playwright and axe are open-source
development tools. Playwright's browser download happens only in development and CI, never in the
application runtime.

**Product modules affected:** All four, through demo data and the UI resilience states. No
feature behavior changes.

## Capabilities

### New Capabilities
- `demo-data`: The demo dataset, its automatic loading and idempotency, the live-consultation and
  reset commands, and the reserved demo account domain.
- `ui-resilience`: Loading, empty, and error states; the error boundary; and the session-ended
  experience across the web app.
- `journey-verification`: The automated browser test of the core journey and cross-cutting
  checks in CI, and the scenario-to-test traceability check.

### Modified Capabilities
- `local-deployment`: Single-command startup loads the demo dataset by default.

## Impact

- API: `apps/api/scripts/seed-demo.ts` (seed, `--live-consultation`, `--reset`), and the docker
  entrypoint runs the seed when `DEMO_DATA=true`.
- Web: shared `QueryState` components, an error boundary, and the session-ended flow.
- New `e2e/` workspace package (Playwright + `@axe-core/playwright`), a
  `docker-compose.e2e.yml` override, a CI job, and a `scripts/check-traceability.mjs` wired into
  CI.
- Docs: new demo guide and testing pages. README and `CLAUDE.md` updates.
