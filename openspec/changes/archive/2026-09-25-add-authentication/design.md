# Design

## Context

Builds on the archived `setup-foundation` change (specs `local-deployment`,
`technical-documentation`). Relevant current state:

- `apps/api` is ESM on NestJS 12 with Prisma 7 (`prisma-client` generator into
  `src/generated/prisma`, pg driver adapter, lazy connection). The schema has no models; the
  only migration enables `btree_gist`.
- `main.ts` applies the request-ID middleware, helmet, the `/api` prefix, and Swagger.
  `test/support/test-app.ts` repeats part of that (no helmet), and
  `scripts/generate-openapi.ts` repeats none of it, so the three bootstraps have already drifted.
- There is no global `ValidationPipe`, cookie parsing, or auth of any kind.
- `apps/web` has React Router (data mode), TanStack Query, the api-client, and shadcn `button`
  and `card` components only. Routes: `/` placeholder and `/status`.
- Docs: `docs/modules/{patient,doctor,admin}.md` are "Planned" stubs; `c4-component.md` lists
  Auth as planned.

## Goals / Non-Goals

**Goals:**
- Establish the auth primitives every later module uses unchanged: `@Public()`, `@Roles()`,
  `@CurrentUser()`, a global guard, and a typed current-user object.
- One bootstrap function for the running app, the tests, and OpenAPI generation.
- A web auth and routing skeleton that later changes add pages to without touching guards.

**Non-Goals:**
- Admin user management, doctor approval, and the audit log (`add-admin-console`). This change
  only adds the account status and verification fields and enforces status.
- Email verification and password reset by email (both would require an email service, which
  the brief forbids). Password change while signed in is included.
- Doctor visibility in search (`add-doctor-discovery`) and booking's profile-complete gate
  (`add-appointment-booking`).
- The landing page (`add-product-website`) and seed/demo data (`harden-core-journey`).

## Decisions

### Opaque server-side sessions, not JWTs
Cookie `th_session` holds 32 random bytes (base64url). The `Session` table stores
`tokenHash = sha256(token)`, `userId`, `createdAt`, `lastUsedAt`, `expiresAt` (createdAt + 12 h),
`revokedAt`, `userAgent`, and `ip`. The guard looks the session up by hash on every request,
rejects it if revoked, expired, or idle for more than 2 h, loads the user, and rejects it unless
the user is `ACTIVE`. `lastUsedAt` is written at most once per minute to limit writes. SHA-256 is
sufficient because the token is high-entropy random data, and it allows an indexed lookup;
argon2 is reserved for passwords.
*Rejected:* a short-lived JWT plus a rotating refresh token. Immediate revocation on logout and
suspension already requires a database check on every request, so a JWT adds signing-key
management and rotation logic without removing that query.

### Cookie and CSRF settings
The cookie is `HttpOnly`, `SameSite=Lax`, `Path=/`, and `Secure` when `COOKIE_SECURE=true`
(default `false`, because the local stack is plain-HTTP localhost). The README says to enable it
behind HTTPS. A global middleware rejects state-changing requests whose `Origin` header is
present and not in `APP_ORIGINS` (default `http://localhost:8080,http://localhost:5173`) with 403.
Requests without `Origin` (curl, tests, server-to-server) pass, which is safe: browsers always
send `Origin` on cross-site POSTs, and SameSite=Lax already withholds the cookie there.
*Rejected:* double-submit CSRF tokens. They duplicate what SameSite plus an Origin check already
provide for a same-origin SPA, and they complicate the generated client.

### Passwords
`@node-rs/argon2` with its argon2id defaults. It ships prebuilt N-API binaries, so there is no
node-gyp build and no pnpm build-script approval, and it works on Alpine (musl).
The policy (10–128 characters, not equal to the email) lives in one shared validator that is used
by registration and password change. Sign-in for an unknown email still verifies against a fixed
dummy hash, so response timing does not reveal whether the account exists.
*Rejected:* the `argon2` package (native build step, and musl prebuild issues) and bcrypt (its
72-byte input limit and weaker memory-hardness).

### Access control primitives
- A global `APP_GUARD` `SessionAuthGuard`: deny by default, skipped when a route has the
  `@Public()` metadata. It attaches `request.user: AuthUser` (`{ id, email, role, sessionId }`).
- A global `RolesGuard` that reads `@Roles(Role.PATIENT, …)`. Registration order: auth, then
  roles.
- `@CurrentUser()` parameter decorator.
- Health, Swagger routes, the specialization list, registration, and sign-in get `@Public()`.
  The Swagger UI is served by `SwaggerModule`, not a controller, so the guard never sees it;
  verify this.
- Self-service endpoints use `/me` paths and never accept a user ID, which rules out access to
  another user's data by construction.
- The guard tests need an admin-only route, and this change ships none. The e2e module
  registers a test-only controller with `@Roles(ADMIN)`, `@Roles(PATIENT)` and `@Roles(DOCTOR)`
  routes. It exists only in `test/`.

### Data model (Prisma)
```
enum Role { PATIENT DOCTOR ADMIN }
enum AccountStatus { ACTIVE SUSPENDED DEACTIVATED }
enum VerificationStatus { PENDING APPROVED REJECTED }

User            id uuid, email unique (stored lowercase), passwordHash, role, status @default(ACTIVE),
                statusReason?, lastLoginAt?, createdAt, updatedAt
Session         id uuid, userId → User (cascade), tokenHash unique, createdAt, lastUsedAt,
                expiresAt, revokedAt?, userAgent?, ip?   @@index([userId])
PatientProfile  userId PK → User (cascade), firstName, lastName, birthDate? (date), weightKg? (decimal 5,2),
                heightCm? (decimal 5,2), phone?, emergencyContactName?, emergencyContactPhone?,
                medicalConditions?, allergies?, currentMedications?, updatedAt
DoctorProfile   userId PK → User (cascade), firstName, lastName, bio?, yearsOfExperience?,
                licenseNumber unique, consultationMinutes @default(30),
                verificationStatus @default(PENDING), reviewNote?, updatedAt
Specialization  id uuid, slug unique, name unique, description
DoctorSpecialization  doctorId → DoctorProfile, specializationId → Specialization, @@id([doctorId, specializationId])
```
Table and column names are snake_case via `@@map`/`@map`. Profile completeness is computed in
the service, not stored, so it can't drift. Registration creates the user, the profile, and the
first session in one transaction.
*Rejected:* a single `users` table with nullable role-specific columns (it muddles ownership and
validation), and an explicit many-to-many table without its own model (explicit models keep
migrations readable).

### Specialization catalog as a data migration
The migration that creates `specializations` also `INSERT`s the 13 rows, with fixed UUIDs and
slugs. `migrate deploy` runs on every container start, so the catalog exists everywhere without a
seed step, and IDs stay stable across environments for later matching rules.
*Rejected:* a seed script (production/compose would not run it) and an in-code constant (no
foreign keys).

### Admin provisioning
`apps/api/scripts/provision-admin.ts` reads `ADMIN_EMAIL` and `ADMIN_PASSWORD`, and creates an
`ADMIN` user if none exists with that email. It never updates an existing account. The docker
entrypoint runs it after `prisma migrate deploy`. Locally, it runs as
`pnpm --filter api run admin:provision`, and `pnpm db:migrate` can call it next. Compose defaults:
`admin@telehealth.local` / `ChangeMe-Admin-2026`, documented as local-only in the README.
If the variables are unset, the script logs that it is skipping and exits 0, so OpenAPI
generation and tests are unaffected.
*Rejected:* provisioning in an `onApplicationBootstrap` hook. It would connect to the database
at app boot, which breaks database-free OpenAPI generation and the "database unreachable" health
scenario.

### Shared bootstrap
`src/bootstrap/configure-app.ts` exports `configureApp(app)`, which applies:
- the request-ID middleware
- `cookie-parser`
- the Origin check
- helmet
- the `/api` prefix
- a global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`)
- Swagger

It is used by `main.ts`, `test/support/test-app.ts`, and `scripts/generate-openapi.ts`. Swagger
gets a cookie security scheme (`th_session`), applied to non-public routes.
*Rejected:* keeping three separate bootstraps, which have already drifted (the tests run without
helmet today).

### Rate limiting
`@nestjs/throttler` with in-memory storage: sign-in limited to 10 per minute per IP, registration
to 5 per minute per IP. It is applied with `@Throttle` on those routes only; the global default
is off. `app.set('trust proxy', 1)` is configured so that behind nginx the client IP comes from
`X-Forwarded-For`, which the nginx config must set.
*Rejected:* a global limit, which would throttle normal SPA polling in later changes.

### Logging redaction
pino `redact` for `req.headers.cookie`, `res.headers["set-cookie"]`, `*.password`,
`*.currentPassword`, `*.newPassword`, and `*.passwordHash`. Request bodies are not logged.

### API surface
| Method | Path | Access |
|---|---|---|
| POST | `/auth/register/patient` | public, throttled |
| POST | `/auth/register/doctor` | public, throttled |
| POST | `/auth/login` | public, throttled |
| POST | `/auth/logout` | signed in → 204 |
| POST | `/auth/logout-all` | signed in → 204 |
| POST | `/auth/password` | signed in → 204 |
| GET | `/auth/me` | signed in |
| GET/PATCH | `/patients/me/profile` | PATIENT |
| GET/PATCH | `/doctors/me/profile` | DOCTOR |
| GET | `/specializations` | public |

The DTOs are class-validator classes with Swagger decorators; response DTOs never include
`passwordHash`. Dates are exchanged as ISO strings (`birthDate` as `YYYY-MM-DD`), and weight and
height as numbers.

### Web app
- Dependencies: `react-hook-form`, `zod`, `@hookform/resolvers`. shadcn components: `input`,
  `label`, `form`, `textarea`, `select`, `checkbox`, `badge`, `alert`, `avatar`, `dropdown-menu`,
  `sonner`, `separator`.
- Auth state: a `useCurrentUser()` TanStack Query on `/auth/me` (a 401 maps to `null`, with no
  retry). Sign-in, sign-up, and sign-out mutations update or invalidate it. A shared api-client
  middleware treats any 401 from a protected call as "session ended": it clears the query cache
  and goes to `/login`.
- Routing uses nested layout routes: `PublicOnly` (`/login`, `/register/patient`,
  `/register/doctor`; redirects signed-in users to their home) and `RequireRole role=…` layouts
  for `/patient/*`, `/doctor/*`, and `/admin/*`. A wrong role redirects to the user's own home.
  Signed-out users go to `/login?returnTo=<path>`. `returnTo` is accepted only if it starts with
  a single `/` (not `//`) and does not contain `://`.
- Pages: sign-in, patient registration, doctor registration (multi-select specializations from
  `/specializations`), patient home (with a "complete your profile" prompt), patient profile,
  doctor home (verification notice), doctor profile, and admin home (placeholder for
  `add-admin-console`).
- Role layout: a header with the role's navigation, `InitialsAvatar`, and a dropdown menu with
  "Sign out" and "Sign out of all devices". The page area shows loading and error states.
- Client-side zod schemas mirror the server rules for inline errors; the server remains
  authoritative.
- `/` gains "Sign in" and "Create account" links; `/status` stays.
*Rejected:* storing auth state in React context alone, which duplicates the server state that
TanStack Query already caches and invalidates.

### Testing approach
- API e2e (supertest with a cookie agent against `telehealth_test`): one test per spec scenario,
  named after it. The database is truncated between test files through a helper. The throttling
  scenario uses a dedicated app instance so it doesn't affect other tests.
- API unit tests: the password policy, the token hashing and expiry evaluation, the Origin check,
  the completeness computation, and the `returnTo` sanitizer (if placed in shared code; otherwise
  covered in web tests).
- Web Vitest tests: the sign-in form (validation and submit), the route guard redirects (signed
  out, wrong role, unsafe `returnTo`), the profile form's inline validation, the incomplete-profile
  prompt, and the doctor verification notices.

## Risks / Trade-offs

- [Registration returns 409 for an existing email, which reveals that the account exists] →
  This is accepted for a prototype without email verification. Sign-in stays generic, and
  registration is rate limited. The trade-off is documented on the auth docs page.
- [An in-memory rate limiter doesn't work across multiple API instances] → The stack runs one
  instance; the docs note that a shared store would be needed for horizontal scaling.
- [Default admin credentials in compose] → They are local-only defaults, overridable with
  `.env`, and the README warns about them. The admin password is never logged.
- [`COOKIE_SECURE=false` by default] → This is required for http://localhost. The README's
  production note says to set it to true behind TLS.
- [A session lookup on every request] → It's an indexed lookup on a unique hash, and
  `lastUsedAt` writes are throttled. This is acceptable at prototype scale.

## Migration Plan

Additive migrations only: auth tables, then profiles and specializations with catalog inserts.
Existing databases (dev and compose volumes) upgrade with `migrate deploy`. Rolling back during
development means `prisma migrate reset` on the dev database.

## Documentation impact

- New `docs/architecture/auth.md`: the session model, a sign-in sequence diagram, the guard
  pipeline, the role matrix, the protections, and the known trade-offs. Add it to the navigation
  under High-level Architecture.
- `docs/architecture/c4-component.md`: Auth, Users, Patients, Doctors, and Specializations move
  to done, with their relationships.
- `docs/modules/patient.md`, `doctor.md`, `admin.md`: module overview for this slice, an L2 view
  of the flows it uses (sign-in, profile), and a Mermaid ER diagram of the tables it owns. The
  sections that later changes will complete stay marked planned.
- A full data model ER diagram page generated from `schema.prisma` (`docs/architecture/data-model.md`).
  Use a Prisma 7-compatible generator that outputs Mermaid Markdown without a headless browser;
  if none works, write a small script over Prisma's DMMF. Regenerating it is part of
  `openapi:generate`'s sibling script, and CI checks it for staleness.
- `docs/index.md` features: accounts and profiles move to done.
- `README.md`: the new environment settings, the admin credentials note, and the
  `COOKIE_SECURE` production note.
