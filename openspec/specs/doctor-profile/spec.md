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
able to change their own verification status or review note. When an `APPROVED` doctor changes
their license number or their set of specializations, their verification status SHALL return to
`PENDING`, and they SHALL be hidden from patients until an administrator reviews them again.
Their existing appointments are kept.

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

#### Scenario: Credential change triggers re-review
- **WHEN** an approved doctor changes their license number or adds a specialization
- **THEN** their verification status becomes `PENDING` and they no longer appear in doctor search

#### Scenario: Other edits keep approval
- **WHEN** an approved doctor changes only their biography or consultation length
- **THEN** their verification status stays `APPROVED`

### Requirement: Accepting-bookings toggle
A signed-in doctor SHALL be able to set whether they are currently accepting new bookings,
independent of their other profile fields, their verification status, and their account status.
This setting MUST NOT trigger the re-review that a credential change (license number or
specializations) does. A newly registered doctor SHALL default to accepting bookings. Turning it
off MUST NOT affect the doctor's existing appointments in any way.

#### Scenario: Turn off accepting bookings
- **WHEN** an approved doctor sets accepting bookings to off
- **THEN** their own profile response reflects it, and their verification status is unchanged

#### Scenario: Turn on accepting bookings
- **WHEN** a doctor who had turned accepting bookings off turns it back on
- **THEN** their own profile response reflects it immediately

#### Scenario: Existing appointments unaffected
- **WHEN** a doctor with upcoming booked appointments turns accepting bookings off
- **THEN** those appointments remain `BOOKED` and reachable by both participants

### Requirement: Availability toggle on the doctor home page
The doctor home page SHALL show an "In" / "Out" control reflecting whether the doctor is currently
accepting bookings, and let the doctor switch it with one action.

#### Scenario: Switch off from the home page
- **WHEN** a doctor switches the control to "Out" on their home page
- **THEN** the change is saved and the control reflects "Out" without navigating away from the page

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
