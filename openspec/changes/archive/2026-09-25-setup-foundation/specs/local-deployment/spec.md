# Spec Delta

## Purpose

Defines how the complete telehealth application runs locally as a self-contained stack, and the
platform behaviors (health, routing, errors, migrations) that every feature module relies on.

## ADDED Requirements

### Requirement: Single-command local startup
The system SHALL start the database, API, and web application together with one Docker Compose
command, using working defaults when no environment file is present.

#### Scenario: Fresh start with default configuration
- **WHEN** a developer runs `docker compose up --build` in a fresh clone without creating a `.env` file
- **THEN** the web application is served at `http://localhost:8080` and the API reports healthy through it

#### Scenario: Data survives a restart
- **WHEN** the stack is stopped with `docker compose down` (without removing volumes) and started again
- **THEN** data previously written to the database is still present

### Requirement: Automatic database migration on startup
The API SHALL apply all pending database migrations before it begins accepting requests.

#### Scenario: Empty database
- **WHEN** the API starts against a database with no schema
- **THEN** all migrations are applied, including enabling the extension required for time-range exclusion constraints, before the health endpoint reports healthy

#### Scenario: Already migrated database
- **WHEN** the API restarts against a database that already has every migration applied
- **THEN** it starts without modifying the schema

### Requirement: Health reporting
The API SHALL expose a public health endpoint at `GET /api/health` that reports overall status
and database connectivity, and MUST NOT expose configuration values, credentials, or user data.

#### Scenario: Database reachable
- **WHEN** a client requests `GET /api/health` while the database is reachable
- **THEN** the response is `200` with an overall status of ok and the database reported as up

#### Scenario: Database unreachable
- **WHEN** a client requests `GET /api/health` while the database is unreachable
- **THEN** the response is `503` with the database reported as down

#### Scenario: No sensitive data exposed
- **WHEN** an unauthenticated client requests `GET /api/health`
- **THEN** the response contains only status information and no connection strings, secrets, or version details of infrastructure

### Requirement: Same-origin routing through the web entrypoint
The web entrypoint SHALL serve the single-page application and forward API and WebSocket traffic
to the API on the same origin, so browsers never call the API cross-origin.

#### Scenario: API request through the web origin
- **WHEN** a browser requests `http://localhost:8080/api/health`
- **THEN** the request is forwarded to the API and the API's response is returned

#### Scenario: Deep link to a client-side route
- **WHEN** a browser directly loads a client-side route such as `http://localhost:8080/some/deep/link`
- **THEN** the single-page application is served instead of a `404` page

#### Scenario: WebSocket upgrade path
- **WHEN** a client opens a WebSocket connection to `/socket.io/` on the web origin
- **THEN** the upgrade request is forwarded to the API

### Requirement: Consistent API error responses
Every API error SHALL be returned as JSON containing the HTTP status code, an error name, a
human-readable message, and the request ID, and MUST NOT include stack traces or internal details.
Database uniqueness and exclusion-constraint violations SHALL be reported as `409 Conflict`, and
missing records as `404 Not Found`.

#### Scenario: Unknown API route
- **WHEN** a client requests an API path that does not exist
- **THEN** the response is `404` with the standard JSON error body including the request ID

#### Scenario: Unexpected server error
- **WHEN** an unhandled error occurs while processing a request
- **THEN** the response is `500` with a generic message and no stack trace, and the error is logged with the request ID

#### Scenario: Constraint violation
- **WHEN** a database write violates a uniqueness or exclusion constraint
- **THEN** the response is `409` with the standard JSON error body

### Requirement: Request traceability
The API SHALL assign every request a request ID, reuse a client-supplied `X-Request-Id` header
when present, return it in the `X-Request-Id` response header, and include it in request logs.

#### Scenario: Client supplies a request ID
- **WHEN** a client sends a request with header `X-Request-Id: abc-123`
- **THEN** the response carries `X-Request-Id: abc-123`

#### Scenario: Client omits a request ID
- **WHEN** a client sends a request without an `X-Request-Id` header
- **THEN** the response carries a newly generated, non-empty `X-Request-Id`

### Requirement: Validated configuration
The API SHALL validate its environment configuration at startup and refuse to start when
required values are missing or malformed.

#### Scenario: Missing database URL
- **WHEN** the API starts without a database connection string configured
- **THEN** it exits with a non-zero code and an error naming the missing setting

### Requirement: Self-contained runtime
The local stack SHALL consist only of runtime-owned containers (database, API, web) and MUST NOT
depend on any third-party hosted service at runtime.

#### Scenario: Offline operation after build
- **WHEN** the stack has been built and is started with no outbound internet access
- **THEN** the web application loads and the API reports healthy
