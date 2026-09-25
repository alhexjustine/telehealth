# Tasks

## 1. Foundations

- [x] 1.1 Add `@fontsource-variable/inter`, theme tokens with AA-checked contrast, and the `useDocumentTitle` hook; unit test for the primary token contrast ratios (≥ 4.5:1)
- [x] 1.2 Add the typed content modules (landing, terms, privacy, disclaimer) and a unit test that the trust section lists the six implemented protections

## 2. Layout and navigation

- [x] 2.1 Build `PublicLayout` (skip link, header with role-aware links, responsive menu, footer) and wire it around `/`, `/terms`, `/privacy`, `/login`, `/register/*`, and the not-found route; Vitest tests "Header links for visitors", "Header for a signed-in user", "Mobile menu"
- [x] 2.2 Add the catch-all not-found page; Vitest test "Unknown route"

## 3. Pages

- [x] 3.1 Build the landing page sections in order with the hero illustration, capability and step cards, doctor section, specializations from the catalog, trust section, emergency notice, and FAQ accordion; Vitest tests "Visitor sees the landing page", "Specializations from the catalog", "Catalog unavailable", "Emergency notice"
- [x] 3.2 Add the `PrototypeNotice` to landing, sign-in, and both registration pages, and terms/privacy links beside the registration submit buttons; Vitest tests "Disclaimer on registration" (rendered above the form) and "Links from registration"
- [x] 3.3 Build `/terms` and `/privacy` from the content modules; Vitest test "Privacy page content"

## 4. Self-contained assets and CSP

- [x] 4.1 Add `scripts/check-no-external-urls.mjs` and `check:assets`, wire it into CI after the web build; verify "Build contains no external references" passes, and that inserting an external URL into a source file makes it fail (then revert)
- [x] 4.2 Add the SPA-only Content-Security-Policy in `apps/web/nginx.conf`; verify via `docker compose up --build` that the app, sign-in, sockets, and `/api/docs` still work and the header is present only on SPA responses
- [x] 4.3 Verify "No third-party requests at runtime" manually (browser devtools or a headless script), stated in the report

## 5. Accessibility

- [x] 5.1 Add the axe-based Vitest check over landing, terms, privacy, and not-found; Vitest test "Automated accessibility check"
- [ ] 5.2 Verify responsiveness manually at 360, 768, 1280, and 1920 px widths (no horizontal scroll) and reduced-motion behavior, stated in the report — no browser tool available; see report for the best-effort static verification done instead. Coordinator: 1280 px (light/dark) checked via headless Chrome screenshots, which found and fixed a dark-mode destructive-color contrast failure; headless Chrome can't emulate < 500 px widths, so the 360 px check is carried by `harden-core-journey`'s Playwright "Narrow viewport" test

## 6. Documentation

- [x] 6.1 Complete `docs/modules/product-website.md`, update `deployment.md` and `docs/index.md`; verify `pnpm docs:build` passes

## 7. Integration check

- [x] 7.1 Run lint, typecheck, unit, e2e, build, `check:assets`, docs build, generated-file freshness checks, `openspec validate --all --strict`, and `docker compose down -v && docker compose up --build`; confirm the landing page and legal pages load through `http://localhost:8080`
