# technical-documentation Specification

## Purpose
Defines the technical documentation site published to GitHub Pages: its required structure,
how diagrams and the API reference stay in sync with the code, and how it is published.

## Requirements

### Requirement: Documentation structure
The documentation site SHALL contain these sections: a Technical Overview (Context, Features); a
High-level Architecture section (C4 L1 Context, C4 L2 Container, C4 L3 Component, and Deployment
diagrams); a Detailed Architecture page for each product module (Product Website, Patient,
Doctor, Admin), each with a Module Overview, an L2 Container view, and a Data Model; and an API
Documentation section.

#### Scenario: All sections reachable from navigation
- **WHEN** a reader opens the documentation home page
- **THEN** every section listed above is reachable from the site navigation

#### Scenario: Incomplete sections are labeled
- **WHEN** a page describes a module or component that has not been implemented yet
- **THEN** the page states that it is planned and names the change that will complete it

### Requirement: Diagrams maintained as text
Architecture diagrams SHALL be stored as text in the repository and rendered when the site is
built. The C4 L2 Container diagram MUST show the web application, the API, and the PostgreSQL
database inside a single system boundary with no external systems, consistent with the brief.

#### Scenario: Diagrams render on build
- **WHEN** the documentation site is built
- **THEN** each architecture diagram renders as an image in the page, and a diagram syntax error fails the build

#### Scenario: Container diagram matches the runtime
- **WHEN** a reader views the C4 L2 Container diagram
- **THEN** it shows the patient, doctor, and administrator using the web application, which calls the API over REST/JSON (and WebSocket for live updates), which stores data in PostgreSQL, and shows no third-party systems

### Requirement: API reference generated from the implementation
The API reference SHALL be generated from the API's own OpenAPI description, and generation MUST
NOT require a running database or server. The same generated description SHALL produce the typed
frontend client.

#### Scenario: Reference reflects the API
- **WHEN** a reader opens the API Documentation section
- **THEN** an interactive reference lists every documented endpoint, including `GET /api/health`

#### Scenario: Generation without a database
- **WHEN** a developer runs the OpenAPI generation command with no database available
- **THEN** the OpenAPI description and typed client are produced successfully

#### Scenario: Stale generated artifacts
- **WHEN** API endpoints change but the generated OpenAPI description or client is not regenerated
- **THEN** the CI pipeline fails and reports that generated files are out of date

### Requirement: Automated publishing
The documentation site SHALL be built and deployed to GitHub Pages automatically when changes
reach the `main` branch, and SHALL also be buildable and previewable locally.

#### Scenario: Push to main
- **WHEN** a commit is pushed to `main`
- **THEN** the documentation workflow builds the site and deploys it to GitHub Pages

#### Scenario: Served from a repository subpath
- **WHEN** the site is built for GitHub Pages under the repository's subpath
- **THEN** all pages, assets, and the API reference load without broken links

#### Scenario: Local preview
- **WHEN** a developer runs the documentation dev command
- **THEN** the site is served locally with live reload
