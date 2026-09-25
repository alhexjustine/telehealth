# Tasks

## 1. Shared bootstrap and config

- [x] 1.1 Create `src/bootstrap/configure-app.ts` (request ID, cookie-parser, helmet, `/api` prefix, global ValidationPipe with whitelist/forbidNonWhitelisted/transform, Swagger with cookie auth scheme, `trust proxy`) and use it from `main.ts`, `test/support/test-app.ts`, and `scripts/generate-openapi.ts`; verify existing unit and e2e suites still pass and `pnpm openapi:generate` output is unchanged apart from the security scheme
- [x] 1.2 Extend the env schema with `APP_ORIGINS`, `COOKIE_SECURE`, `SESSION_IDLE_MINUTES` (120), `SESSION_ABSOLUTE_HOURS` (12), optional `ADMIN_EMAIL`/`ADMIN_PASSWORD`; add defaults to `docker-compose.yml`, `.env.example`, `apps/api/.env.example`, and CI; extend `env.schema.spec.ts` for the new keys
- [x] 1.3 Add pino redaction for cookies, set-cookie, and password fields; unit/e2e test "Password never exposed" for log output (capture logger output during a sign-in request and assert no password or hash appears)
- [x] 1.4 Confirm `apps/web/nginx.conf` forwards `X-Forwarded-For`/`X-Real-IP` to the API (add if missing) and verify through the compose stack that the API logs the client address

## 2. Data model

- [x] 2.1 Add Prisma models and enums from design.md (snake_case mapping) and a migration for users and sessions; run `pnpm --filter api run prisma:generate` and verify `pnpm db:migrate` applies cleanly on a fresh dev DB
- [x] 2.2 Add the migration for profiles, specializations, and the link table including `INSERT`s for the 13 catalog specializations with fixed UUIDs and slugs; e2e test "Catalog available after migration"
- [x] 2.3 Add a test helper that truncates all non-catalog tables between e2e files and verify tests are order-independent (run the e2e suite twice)

## 3. Auth core (API)

- [x] 3.1 Implement the password policy validator and `@node-rs/argon2` hashing service; unit tests for the policy (length bounds, equals-email) and hash/verify round trip; e2e test "Password too short"
- [x] 3.2 Implement the session service (create, lookup by token hash, idle/absolute expiry, throttled `lastUsedAt`, revoke one/all/all-but-current) and cookie helpers; unit tests for expiry evaluation and token hashing
- [x] 3.3 Implement `SessionAuthGuard` (global, deny by default), `@Public()`, `RolesGuard`, `@Roles()`, `@CurrentUser()`; mark health, specializations, register, login public; add the test-only role controller under `test/`; e2e tests "Protected endpoint without a session", "Public endpoint without a session", "Wrong role", "Admin-only endpoint", "Authenticated request", "Expired session", "Tampered or unknown token", "Account suspended while signed in"
- [x] 3.4 Implement the Origin check middleware; unit tests plus e2e tests "Foreign origin" and "Application origin"
- [x] 3.5 Implement `POST /auth/register/patient` and `/auth/register/doctor` (single transaction: user + profile + session); e2e tests "Successful patient registration", "Email already registered", "Invalid registration input", "Successful doctor registration", "Unknown specialization", "License number already used", "No public admin creation"
- [x] 3.6 Implement `POST /auth/login` with generic failures, dummy-hash timing equalization, status check, and `lastLoginAt`; e2e tests "Valid credentials", "Wrong password or unknown email", "Suspended or deactivated account"
- [x] 3.7 Add throttling on login and registration; e2e test "Too many attempts" in an isolated app instance
- [x] 3.8 Implement `POST /auth/logout`, `/auth/logout-all`, `/auth/password`; e2e tests "Sign out of this device", "Sign out everywhere", "Sign-out without a session", "Successful password change", "Wrong current password"
- [x] 3.9 Implement `GET /auth/me` with role-specific summary; e2e tests "Signed-in patient", "Signed-in doctor", "Not signed in"

## 4. Profiles and catalog (API)

- [x] 4.1 Implement `GET /specializations` (public, sorted by name) with no write routes; e2e tests "Visitor lists specializations" and "Write attempt"
- [x] 4.2 Implement `GET/PATCH /patients/me/profile` with validation rules and computed completeness; e2e tests "Patient views profile", "Non-patient denied", "Signed-out denied" (patient), "Valid update" (patient), "Out-of-range values", "Cannot change another patient", "Newly registered patient", "Required fields filled"
- [x] 4.3 Implement `GET/PATCH /doctors/me/profile` with validation, specialization replacement, and license uniqueness; e2e tests "Doctor views profile", "Non-doctor denied", "Signed-out denied" (doctor), "Valid update" (doctor), "Invalid values", "Cannot self-verify", "Duplicate license number"
- [x] 4.4 Regenerate the OpenAPI document and client (`pnpm openapi:generate`) and verify the generated client types include every new endpoint and the web package typechecks

## 5. Admin provisioning

- [x] 5.1 Add `scripts/provision-admin.ts` (create-if-missing, never update, skip when unset) and `admin:provision` script; run it from the docker entrypoint after migrations; e2e/script tests "First startup" and "Restart does not overwrite"; verify via `docker compose up --build` that the default admin can sign in through `http://localhost:8080/api/auth/login`

## 6. Web app

- [x] 6.1 Add form dependencies and shadcn components listed in design.md; verify `pnpm --filter web build` passes
- [x] 6.2 Implement `useCurrentUser`, auth mutations, the api-client 401 handling, `PublicOnly` and `RequireRole` layouts, and the `returnTo` sanitizer; Vitest tests "Signed-out user opens a protected page", "Wrong role area", "Unsafe return address"
- [x] 6.3 Build sign-in and both registration pages with zod validation and server error display (409/400/401/403/429 messages); Vitest tests for sign-in validation and "Sign-in lands in the role area"
- [x] 6.4 Build the role layout (nav, `InitialsAvatar`, sign-out / sign-out-all menu) and home pages for patient, doctor (verification notice), and admin (placeholder); Vitest tests "Incomplete profile prompt", "Pending doctor", "Rejected doctor"
- [x] 6.5 Build patient and doctor profile pages; Vitest tests "Inline validation" and "Edit specializations"
- [x] 6.6 Add "Sign in" / "Create account" links on `/`; verify the full flow manually in a browser against `pnpm dev`: register patient → complete profile → sign out → sign in; register doctor → see pending notice; sign in as admin; patient opening `/doctor` is redirected

## 7. Documentation

- [x] 7.1 Add `docs/architecture/auth.md` (session model, sign-in sequence diagram, guard pipeline, role matrix, protections, trade-offs) to navigation; verify `pnpm docs:build` passes
- [x] 7.2 Add the generated full ER diagram page (`docs/architecture/data-model.md`) with its generation script wired next to `openapi:generate` and into the CI freshness check; verify regenerating produces no diff
- [x] 7.3 Update `c4-component.md`, `docs/index.md` features, and the Patient, Doctor, and Admin module pages (overview, L2 view, data model for this slice; remaining sections still labeled planned); verify diagrams render and "Incomplete sections are labeled" still holds
- [x] 7.4 Update `README.md` (new env settings, default admin credentials as local-only, `COOKIE_SECURE` for HTTPS) and the Gotchas in `CLAUDE.md` if new non-obvious conventions emerged (e.g. `@Public()` deny-by-default)

## 8. Integration check

- [x] 8.1 Run lint, typecheck, unit, e2e, build, docs build, `openspec validate --all --strict`, and `docker compose down -v && docker compose up --build`; confirm all pass and the admin, a new patient, and a new doctor can each sign in through `http://localhost:8080`
