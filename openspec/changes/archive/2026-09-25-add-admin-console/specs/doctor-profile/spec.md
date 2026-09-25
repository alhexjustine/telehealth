# Spec Delta

## MODIFIED Requirements

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
