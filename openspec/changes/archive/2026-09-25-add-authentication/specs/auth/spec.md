# Spec Delta

## Purpose

Establishes who a user is and what they may do: application-managed accounts for patients,
doctors, and a pre-provisioned administrator, server-side sessions, and role-based access control
enforced by the API and reflected in the web app's role areas.

## ADDED Requirements

### Requirement: Patient registration
The system SHALL let a visitor create a patient account with an email address, a password, and a
first and last name, and SHALL sign the new patient in on success. Email addresses MUST be
treated case-insensitively and stored normalized to lowercase.

#### Scenario: Successful patient registration
- **WHEN** a visitor submits a valid email, password, first name, and last name to patient registration
- **THEN** a patient account is created with an active status, a session is started, and the response contains the user's ID, email, and role without any password data

#### Scenario: Email already registered
- **WHEN** a visitor registers with an email that already belongs to any account, in any letter case
- **THEN** the response is `409` and no account is created

#### Scenario: Invalid registration input
- **WHEN** a visitor submits a malformed email, a password that violates the password policy, a missing name, or any unknown field (such as `role`)
- **THEN** the response is `400` listing the invalid fields and no account is created

### Requirement: Doctor registration
The system SHALL let a visitor create a doctor account with an email address, a password, a
first and last name, at least one specialization from the catalog, and a license number, and
SHALL sign the new doctor in on success. New doctor accounts MUST start with verification status
`PENDING`.

#### Scenario: Successful doctor registration
- **WHEN** a visitor submits valid doctor registration details with one or more existing specializations
- **THEN** a doctor account and profile are created with verification status `PENDING`, and a session is started

#### Scenario: Unknown specialization
- **WHEN** a visitor submits doctor registration with a specialization that is not in the catalog
- **THEN** the response is `400` and no account is created

#### Scenario: License number already used
- **WHEN** a visitor submits doctor registration with a license number that another doctor already has
- **THEN** the response is `409` and no account is created

### Requirement: Password policy and storage
Passwords SHALL be 10 to 128 characters long and MUST NOT equal the account's email address.
Passwords MUST be stored only as a salted, memory-hard hash and MUST never appear in any API
response or log.

#### Scenario: Password too short
- **WHEN** a visitor registers with a 9-character password
- **THEN** the response is `400` naming the password field

#### Scenario: Password never exposed
- **WHEN** any auth, profile, or current-user response is returned, or a request containing a password is logged
- **THEN** neither the password nor its hash appears in the response body or log output

### Requirement: Sign-in
The system SHALL sign a user in when the email and password match an active account, starting a
new session. Failures MUST use a single generic message that does not reveal whether the email
exists.

#### Scenario: Valid credentials
- **WHEN** a user submits the correct email (in any letter case) and password for an active account
- **THEN** the response is `200` with the user's ID, email, and role, and a session cookie is set

#### Scenario: Wrong password or unknown email
- **WHEN** a user submits a wrong password for an existing email, or an email that has no account
- **THEN** the response is `401` with the same generic message in both cases and no session cookie is set

#### Scenario: Suspended or deactivated account
- **WHEN** a user submits correct credentials for an account whose status is suspended or deactivated
- **THEN** the response is `403` stating the account is not active, and no session is started

#### Scenario: Too many attempts
- **WHEN** more than 10 sign-in attempts arrive from the same client address within one minute
- **THEN** further attempts receive `429` until the window passes

### Requirement: Sessions
A session SHALL be represented to the browser only by an opaque random token in an httpOnly,
SameSite=Lax cookie; the server MUST store only a hash of the token. Sessions SHALL expire after
2 hours without activity and 12 hours after sign-in, whichever comes first.

#### Scenario: Authenticated request
- **WHEN** a request carries a valid, unexpired session cookie
- **THEN** the request is processed as that user and the session's last activity time is updated

#### Scenario: Expired session
- **WHEN** a request carries a session cookie whose session has been idle more than 2 hours or was started more than 12 hours ago
- **THEN** the response is `401` and the session is no longer usable

#### Scenario: Tampered or unknown token
- **WHEN** a request carries a session cookie that does not match any stored session
- **THEN** the response is `401`

### Requirement: Sign-out
The system SHALL let a signed-in user end the current session, or end all of their sessions on
every device.

#### Scenario: Sign out of this device
- **WHEN** a signed-in user signs out
- **THEN** the response is `204`, the session cookie is cleared, and a later request with the old token receives `401`

#### Scenario: Sign out everywhere
- **WHEN** a signed-in user chooses to sign out of all devices
- **THEN** every session belonging to that user stops working, including sessions in other browsers

#### Scenario: Sign-out without a session
- **WHEN** a request to sign out carries no valid session
- **THEN** the response is `401`

### Requirement: Password change
The system SHALL let a signed-in user change their password by supplying the current password
and a new password that meets the policy, and SHALL end all of that user's other sessions.

#### Scenario: Successful password change
- **WHEN** a signed-in user submits the correct current password and a valid new password
- **THEN** the response is `204`, the new password works for sign-in, the old one does not, and the user's other sessions stop working while the current one continues

#### Scenario: Wrong current password
- **WHEN** a signed-in user submits an incorrect current password
- **THEN** the response is `403` and the password is unchanged

### Requirement: Current user
The system SHALL return the signed-in user's ID, email, role, status, display name, and a
role-specific summary: profile completeness for patients, and verification status for doctors.

#### Scenario: Signed-in patient
- **WHEN** a signed-in patient requests the current user
- **THEN** the response includes role `PATIENT`, their display name, and whether their profile is complete

#### Scenario: Signed-in doctor
- **WHEN** a signed-in doctor requests the current user
- **THEN** the response includes role `DOCTOR`, their display name, and their verification status

#### Scenario: Not signed in
- **WHEN** a request for the current user carries no valid session
- **THEN** the response is `401`

### Requirement: Account status enforcement
Only accounts with status `ACTIVE` SHALL be able to use a session. When an account's status
changes away from `ACTIVE`, its existing sessions MUST stop working on the very next request.

#### Scenario: Account suspended while signed in
- **WHEN** a signed-in user's account status is changed to suspended and they make another request
- **THEN** the response is `401` and their sessions are revoked

### Requirement: Deny-by-default access control
Every API endpoint SHALL require a valid session unless it is explicitly designated public. The
public endpoints in this change are health, API documentation, the specialization catalog,
registration, and sign-in.

#### Scenario: Protected endpoint without a session
- **WHEN** an unauthenticated client calls any non-public endpoint
- **THEN** the response is `401`

#### Scenario: Public endpoint without a session
- **WHEN** an unauthenticated client calls the health endpoint or the specialization catalog
- **THEN** the request succeeds

### Requirement: Role-based authorization
Endpoints restricted to specific roles SHALL reject users of any other role, and a user MUST only
be able to read or change their own account and profile through the self-service endpoints.

#### Scenario: Wrong role
- **WHEN** a signed-in doctor calls a patient-only endpoint, or a signed-in patient calls a doctor-only or admin-only endpoint
- **THEN** the response is `403`

#### Scenario: Admin-only endpoint
- **WHEN** a signed-in administrator calls an admin-only endpoint
- **THEN** the request is allowed

### Requirement: Cross-origin request protection
State-changing requests (any method other than GET, HEAD, or OPTIONS) that carry an `Origin`
header SHALL be rejected unless the origin is on the configured allow-list.

#### Scenario: Foreign origin
- **WHEN** a POST request carries `Origin: https://evil.example`
- **THEN** the response is `403` and the request has no effect

#### Scenario: Application origin
- **WHEN** a POST request carries the application's own origin
- **THEN** the request is processed normally

### Requirement: Pre-provisioned administrator
The system SHALL create the administrator account from configuration when the application
starts, if an account with that email does not already exist, and MUST NOT offer any public way
to create an administrator or change an account's role.

#### Scenario: First startup
- **WHEN** the stack starts against an empty database with the administrator email and password configured
- **THEN** an active administrator account exists and can sign in with those credentials

#### Scenario: Restart does not overwrite
- **WHEN** the stack restarts and the administrator account already exists
- **THEN** the account and its password are left unchanged

#### Scenario: No public admin creation
- **WHEN** a visitor submits patient or doctor registration including a `role` of `ADMIN`
- **THEN** the response is `400` and no account is created

### Requirement: Role areas in the web app
The web app SHALL provide sign-in and registration pages and a separate area per role (patient,
doctor, admin), each with its own navigation, the user's initials avatar, and sign-out. Signed-out
users visiting a role area MUST be sent to sign-in and returned afterwards; signed-in users MUST
only reach their own role's area.

#### Scenario: Sign-in lands in the role area
- **WHEN** a user signs in from the sign-in page
- **THEN** they arrive at their role's home page (patient, doctor, or admin)

#### Scenario: Signed-out user opens a protected page
- **WHEN** a signed-out visitor opens a page inside a role area
- **THEN** they are redirected to sign-in, and after signing in they are returned to the page they requested

#### Scenario: Wrong role area
- **WHEN** a signed-in patient opens a page in the doctor or admin area
- **THEN** they are redirected to the patient home page

#### Scenario: Unsafe return address
- **WHEN** the sign-in page is opened with a return address pointing to another site
- **THEN** after sign-in the user goes to their role home page instead
