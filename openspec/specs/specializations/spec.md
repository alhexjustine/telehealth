# specializations Specification

## Purpose
Provides the fixed catalog of medical specializations that doctor profiles reference and that
doctor discovery and symptom matching will build on.

## Requirements

### Requirement: Specialization catalog
The system SHALL ship a catalog of specializations as reference data present in every
environment without a separate seeding step. Each specialization SHALL have a stable ID, a unique
URL-safe slug, a display name, and a short patient-friendly description. The initial catalog
MUST include at least: General Practice, Internal Medicine, Pediatrics, Dermatology, Cardiology,
Neurology, Psychiatry, Obstetrics & Gynecology, Otolaryngology (ENT), Orthopedics,
Gastroenterology, Pulmonology, and Endocrinology.

#### Scenario: Catalog available after migration
- **WHEN** the database has been migrated on a fresh installation
- **THEN** every listed specialization exists with its slug, name, and description

### Requirement: Public catalog listing
The system SHALL let anyone, signed in or not, list the specialization catalog sorted by name.

#### Scenario: Visitor lists specializations
- **WHEN** an unauthenticated client requests the specialization list
- **THEN** the response is `200` with every specialization's ID, slug, name, and description, sorted by name

### Requirement: Catalog is read-only through the API
The system MUST NOT expose any endpoint that creates, changes, or deletes specializations.

#### Scenario: Write attempt
- **WHEN** any client, including an administrator, sends a POST, PATCH, PUT, or DELETE request to the specialization list
- **THEN** the response is `404` or `405` and the catalog is unchanged
