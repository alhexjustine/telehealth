# doctor-profile Specification

## Purpose
Lets a doctor maintain the professional profile patients will later see in discovery (name,
specializations, biography, experience, license, consultation length) and shows its verification
status.

## Requirements

### Requirement: View own profile
A signed-in doctor SHALL be able to view their own profile: first and last name, specializations,
biography, years of experience, license number, consultation length, verification status, and any
review note left by an administrator.

#### Scenario: Doctor views profile
- **WHEN** a signed-in doctor requests their profile
- **THEN** the response contains their profile fields, specializations (ID and name), and verification status

#### Scenario: Non-doctor denied
- **WHEN** a signed-in patient or administrator requests the doctor self-profile endpoint
- **THEN** the response is `403`

#### Scenario: Signed-out denied
- **WHEN** an unauthenticated client requests the doctor self-profile endpoint
- **THEN** the response is `401`

### Requirement: Update own profile
A signed-in doctor SHALL be able to update their names, specializations, biography, years of
experience, license number, and consultation length. The system MUST require at least one
specialization from the catalog, a biography of at most 2000 characters, years of experience
between 0 and 70, a license number of 4 to 32 letters, digits, or dashes that no other doctor
uses, and a consultation length of 15, 20, 30, 45, or 60 minutes (default 30). Doctors MUST NOT be
able to change their own verification status or review note.

#### Scenario: Valid update
- **WHEN** a signed-in doctor submits a new biography and an additional specialization
- **THEN** the profile is updated and returned with both specializations

#### Scenario: Invalid values
- **WHEN** a signed-in doctor submits an empty specialization list or a consultation length of 25 minutes
- **THEN** the response is `400` naming each invalid field and nothing is saved

#### Scenario: Cannot self-verify
- **WHEN** a signed-in doctor submits an update that includes a verification status or review note
- **THEN** the response is `400` and the verification status is unchanged

#### Scenario: Duplicate license number
- **WHEN** a signed-in doctor changes their license number to one another doctor already has
- **THEN** the response is `409` and nothing is saved

### Requirement: Verification status visibility
The doctor area SHALL show the doctor's verification status. While the status is `PENDING` or
`REJECTED`, the doctor home page MUST explain that the profile is not yet visible to patients
and, when rejected, show the administrator's review note.

#### Scenario: Pending doctor
- **WHEN** a doctor with verification status `PENDING` opens the doctor home page
- **THEN** a notice explains the profile is awaiting review and is not visible to patients

#### Scenario: Rejected doctor
- **WHEN** a doctor with verification status `REJECTED` and a review note opens the doctor home page
- **THEN** a notice shows the rejection and the review note

### Requirement: Profile page in the web app
The doctor area SHALL include a profile page for viewing and editing these fields, with
specialization selection from the catalog and inline validation messages.

#### Scenario: Edit specializations
- **WHEN** a doctor selects an additional specialization on the profile page and saves
- **THEN** the saved profile shows the added specialization
