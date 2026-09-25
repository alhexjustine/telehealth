# Spec Delta

## Purpose

Makes every privileged action traceable. The audit log records who did what to which record,
when, why, and what changed, and the entries cannot be altered.

## ADDED Requirements

### Requirement: Recording administrator actions
The system SHALL write one audit entry for each of these administrator actions, in the same
database transaction as the action:
- account status change
- doctor approval
- doctor rejection
- doctor profile edit
- appointment cancellation
- marking an appointment not held
- administrator sign-in
Each entry SHALL record:
- the acting administrator, the action, and the affected record's type and ID
- the reason, if any, and the relevant field values before and after
- the request ID, client IP address, and timestamp
Audit entries MUST NOT contain passwords, session tokens, or clinical content. If the action
fails, no entry MUST be written.

#### Scenario: Status change audited
- **WHEN** an administrator suspends an account with a reason
- **THEN** exactly one audit entry exists with action `USER_STATUS_CHANGED`, the account ID, the reason, status before `ACTIVE` and after `SUSPENDED`, and the request ID

#### Scenario: Deactivation lists cancelled appointments
- **WHEN** an administrator deactivates an account that had upcoming appointments
- **THEN** the audit entry's after-values list the IDs of the appointments that were cancelled

#### Scenario: Failed action not audited
- **WHEN** an administrator's action is rejected, for example rejecting a doctor without a note
- **THEN** no audit entry is written

#### Scenario: Admin sign-in audited
- **WHEN** an administrator signs in
- **THEN** an audit entry with action `ADMIN_SIGNED_IN` is written with the client IP address

### Requirement: Immutable log
Audit entries MUST NOT be modifiable or removable through the API or through ordinary database
updates and deletes.

#### Scenario: No API to change entries
- **WHEN** any client sends PATCH, PUT, or DELETE requests to audit log endpoints
- **THEN** the response is `404` or `405`

#### Scenario: Database blocks changes
- **WHEN** an UPDATE or DELETE statement targets an audit entry directly in the database
- **THEN** the database rejects the statement

### Requirement: Viewing the audit log
An administrator SHALL be able to list audit entries, newest first and paginated, filtered by
action, by acting administrator, by affected record type and ID, and by date range. They SHALL be
able to view a single entry with its before and after values.

#### Scenario: Filter by affected record
- **WHEN** an administrator filters the audit log by a doctor's ID
- **THEN** every entry about that doctor is returned, newest first, and no others

#### Scenario: Non-admin denied
- **WHEN** a signed-in patient or doctor requests the audit log
- **THEN** the response is `403`

### Requirement: Audit page in the web app
The admin area SHALL include an audit log page with the filters and a table. Opening an entry
SHALL show a readable diff of the before and after values. The admin pages for users, doctors,
and appointments SHALL link to the audit entries for the record being viewed.

#### Scenario: Diff view
- **WHEN** an administrator opens an audit entry for a doctor profile edit
- **THEN** the changed fields are shown with their old and new values
