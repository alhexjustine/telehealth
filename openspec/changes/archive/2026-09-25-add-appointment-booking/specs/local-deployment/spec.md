# Spec Delta

## MODIFIED Requirements

### Requirement: Consistent API error responses
Every API error SHALL be returned as JSON containing the HTTP status code, an error name, a
human-readable message, and the request ID, and MUST NOT include stack traces or internal details.
Errors caused by a business rule SHALL also include a machine-readable `code` in
UPPER_SNAKE_CASE (for example `SLOT_UNAVAILABLE`), which stays stable across releases. Database
uniqueness and exclusion-constraint violations SHALL be reported as `409 Conflict`, and missing
records as `404 Not Found`.

#### Scenario: Unknown API route
- **WHEN** a client requests an API path that does not exist
- **THEN** the response is `404` with the standard JSON error body including the request ID

#### Scenario: Unexpected server error
- **WHEN** an unhandled error occurs while processing a request
- **THEN** the response is `500` with a generic message and no stack trace, and the error is logged with the request ID

#### Scenario: Constraint violation
- **WHEN** a database write violates a uniqueness or exclusion constraint
- **THEN** the response is `409` with the standard JSON error body

#### Scenario: Business-rule error code
- **WHEN** a request is rejected because of a business rule, such as booking a slot that is no longer available
- **THEN** the response body includes the rule's stable `code` alongside the standard fields
