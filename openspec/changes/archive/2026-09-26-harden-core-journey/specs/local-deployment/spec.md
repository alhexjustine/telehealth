# Spec Delta

## MODIFIED Requirements

### Requirement: Single-command local startup
The system SHALL start the database, API, and web application together with one Docker Compose
command, using working defaults when no environment file is present. By default, that startup
SHALL also provision the administrator account and load the demo dataset, so the application can
be explored immediately.

#### Scenario: Fresh start with default configuration
- **WHEN** a developer runs `docker compose up --build` in a fresh clone without creating a `.env` file
- **THEN** the web application is served at `http://localhost:8080` and the API reports healthy through it

#### Scenario: Data survives a restart
- **WHEN** the stack is stopped with `docker compose down` (without removing volumes) and started again
- **THEN** data previously written to the database is still present

#### Scenario: Ready to explore
- **WHEN** a developer runs `docker compose up --build` in a fresh clone and opens `http://localhost:8080`
- **THEN** they can sign in with the documented administrator, demo doctor, and demo patient credentials and see populated data
