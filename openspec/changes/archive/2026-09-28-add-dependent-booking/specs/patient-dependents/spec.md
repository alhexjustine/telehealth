# Spec Delta

## Purpose

Lets a patient account manage the people besides itself — a child, a parent, a spouse, or someone
else — that it books appointments for, each with their own identity and medical history, with no
login of their own.

## ADDED Requirements

### Requirement: Add a dependent
A signed-in patient SHALL be able to add a dependent to their own account: first name (1-100
characters), last name (1-100 characters), birthdate (required, in the past, implying an age of at
most 120 years), a relationship (`CHILD`, `PARENT`, `SPOUSE`, or `OTHER`), and optionally medical
conditions, allergies, and current medications, each at most 2000 characters — the same
medical-history shape and limits as the account's own profile. An account MUST NOT have more than
10 active dependents at a time; a removed dependent (see "Remove a dependent") does not count
toward this limit.

#### Scenario: Successful add
- **WHEN** a signed-in patient adds a dependent with a name, a past birthdate, and relationship `CHILD`
- **THEN** the response is `201` with the dependent, owned by that patient

#### Scenario: Missing required field
- **WHEN** a signed-in patient tries to add a dependent without a birthdate or without a relationship
- **THEN** the response is `400` naming the missing field and nothing is created

#### Scenario: Future birthdate
- **WHEN** a signed-in patient tries to add a dependent with a birthdate in the future
- **THEN** the response is `400` and nothing is created

#### Scenario: Too many dependents
- **WHEN** a signed-in patient who already has 10 active dependents tries to add another
- **THEN** the response is `409` with code `DEPENDENT_LIMIT_REACHED`

#### Scenario: Signed-out denied
- **WHEN** an unauthenticated client tries to add a dependent
- **THEN** the response is `401`

#### Scenario: Non-patient denied
- **WHEN** a signed-in doctor or administrator tries to add a dependent through the patient endpoint
- **THEN** the response is `403`

### Requirement: List, view, and update a dependent
A signed-in patient SHALL be able to list their own active dependents, view one of their own
dependents by ID, and update any of its fields, validated the same way as adding one. Every
operation MUST return `404` for a dependent that does not belong to the caller, the same
non-disclosure posture as the rest of this application's ownership checks.

#### Scenario: List own dependents
- **WHEN** a signed-in patient with two dependents lists them
- **THEN** both are returned, each with their name, relationship, birthdate, and medical-history fields

#### Scenario: Update fields
- **WHEN** a signed-in patient updates one of their dependents' allergies
- **THEN** only that field changes and the updated dependent is returned

#### Scenario: Another account's dependent
- **WHEN** a signed-in patient requests or updates a dependent belonging to another account
- **THEN** the response is `404` and nothing changes

### Requirement: Remove a dependent
A signed-in patient SHALL be able to remove one of their own dependents. Removing SHALL hide the
dependent from future booking and from the active dependents list, but MUST NOT delete or alter
any appointment, message, or record already associated with them — the same "never orphan history"
posture this application already applies to other historical relationships.

#### Scenario: Remove a dependent
- **WHEN** a signed-in patient removes one of their dependents
- **THEN** the response is `200`, the dependent no longer appears when listing active dependents, and cannot be selected when booking a new appointment

#### Scenario: Removed dependent's history remains
- **WHEN** a patient removes a dependent who has a completed consultation
- **THEN** that consultation is still visible in the patient's records, still shown as being for that dependent

#### Scenario: Already removed
- **WHEN** a signed-in patient tries to remove a dependent they already removed, or one belonging to another account
- **THEN** the response is `404`

### Requirement: Dependents in the web app
The patient area SHALL include a Dependents page, reachable from Profile, listing active
dependents with their name, relationship, and age, and add/edit/remove actions. Removing SHALL
require a confirmation.

#### Scenario: Add from the web app
- **WHEN** a patient fills in a dependent's name, birthdate, and relationship on the Dependents page and submits
- **THEN** the new dependent appears in the list

#### Scenario: Remove confirmation
- **WHEN** a patient clicks remove on a dependent
- **THEN** a confirmation is shown before the dependent is actually removed
