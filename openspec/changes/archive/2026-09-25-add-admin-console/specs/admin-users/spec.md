# Spec Delta

## Purpose

Lets administrators find patient and doctor accounts and change whether they may use the platform,
with the side effects applied consistently and every change justified by a reason.

## ADDED Requirements

### Requirement: Search accounts
An administrator SHALL be able to list accounts, paginated and newest first, filtered by role
(patient, doctor, admin), by status, and by a text query matching email or display name
(case-insensitive). Each result SHALL include:
- ID, email, role, status, and status reason
- display name, creation time, and last sign-in time
- number of upcoming booked appointments

#### Scenario: Filter by role and status
- **WHEN** an administrator lists accounts with role doctor and status suspended
- **THEN** only suspended doctor accounts are returned, with the total count

#### Scenario: Text query
- **WHEN** an administrator searches for `santos`
- **THEN** accounts whose email or display name contains "santos" are returned

#### Scenario: Non-admin denied
- **WHEN** a signed-in patient or doctor calls any admin account endpoint
- **THEN** the response is `403`

### Requirement: Change account status
An administrator SHALL be able to set a patient or doctor account's status to `ACTIVE`,
`SUSPENDED`, or `DEACTIVATED` with a required reason of 5 to 500 characters. Changing to
`SUSPENDED` or `DEACTIVATED` MUST revoke all of the account's sessions immediately. Changing to
`DEACTIVATED` MUST also cancel every upcoming `BOOKED` appointment of that account, with the
account-deactivation reason. Administrator accounts MUST NOT be changeable through this endpoint.
Setting the status an account already has MUST be rejected.

#### Scenario: Suspend a patient
- **WHEN** an administrator suspends a signed-in patient with reason "Repeated abusive messages to staff"
- **THEN** the account status is `SUSPENDED` with that reason, and the patient's next request receives `401`

#### Scenario: Deactivate a doctor with bookings
- **WHEN** an administrator deactivates a doctor who has two upcoming booked appointments
- **THEN** the account is `DEACTIVATED`, both appointments are `CANCELLED` with the deactivation reason, and the doctor no longer appears in doctor search

#### Scenario: Reactivate
- **WHEN** an administrator sets a suspended account back to `ACTIVE`
- **THEN** the account can sign in again, and its previously cancelled appointments stay cancelled

#### Scenario: Missing reason
- **WHEN** an administrator changes an account's status without a reason
- **THEN** the response is `400` and the status is unchanged

#### Scenario: Admin account protected
- **WHEN** an administrator tries to change the status of any administrator account, including their own
- **THEN** the response is `403` and nothing changes

#### Scenario: No-op change
- **WHEN** an administrator sets an account to the status it already has
- **THEN** the response is `409` with code `STATUS_UNCHANGED`

### Requirement: Users page in the web app
The admin area SHALL include a users page with search, role and status filters, a results table,
and a status-change dialog. The dialog requires a reason and, for deactivation, states how many
upcoming appointments will be cancelled before the administrator confirms.

#### Scenario: Deactivation warning
- **WHEN** an administrator opens the deactivate dialog for a doctor with three upcoming appointments
- **THEN** the dialog states that three appointments will be cancelled and requires a reason before confirming
