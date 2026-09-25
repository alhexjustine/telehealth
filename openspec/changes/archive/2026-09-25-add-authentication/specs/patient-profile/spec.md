# Spec Delta

## Purpose

Lets a patient keep their own profile and basic medical history up to date, and defines when a
profile counts as complete so later features (such as booking) can require it.

## ADDED Requirements

### Requirement: View own profile
A signed-in patient SHALL be able to view their own profile: first and last name, birthday,
weight, height, phone number, emergency contact name and phone, medical conditions, allergies,
current medications, and whether the profile is complete.

#### Scenario: Patient views profile
- **WHEN** a signed-in patient requests their profile
- **THEN** the response contains their profile fields and completeness, with unset optional fields empty

#### Scenario: Non-patient denied
- **WHEN** a signed-in doctor or administrator requests the patient self-profile endpoint
- **THEN** the response is `403`

#### Scenario: Signed-out denied
- **WHEN** an unauthenticated client requests the patient self-profile endpoint
- **THEN** the response is `401`

### Requirement: Update own profile
A signed-in patient SHALL be able to update any of their profile fields. The system MUST validate
that the birthday is in the past and implies an age of at most 120 years, weight is between 1 and
500 kg, height is between 30 and 272 cm, phone numbers contain 7 to 20 digits with an optional
leading `+`, names are 1 to 100 characters, and each free-text medical field is at most 2000
characters.

#### Scenario: Valid update
- **WHEN** a signed-in patient submits valid values for some profile fields
- **THEN** only those fields change and the updated profile is returned

#### Scenario: Out-of-range values
- **WHEN** a signed-in patient submits a future birthday, a weight of 0, or a height of 400 cm
- **THEN** the response is `400` naming each invalid field and nothing is saved

#### Scenario: Cannot change another patient
- **WHEN** a signed-in patient submits a profile update that includes another user's ID or any field outside the profile
- **THEN** the response is `400` and no profile other than their own can be affected

### Requirement: Profile completeness
A patient profile SHALL be complete when first name, last name, birthday, weight, height, and
phone number are all set. Medical history fields and the emergency contact MUST NOT be required
for completeness.

#### Scenario: Newly registered patient
- **WHEN** a patient has just registered with only email, password, and name
- **THEN** their profile is reported as incomplete

#### Scenario: Required fields filled
- **WHEN** a patient sets birthday, weight, height, and phone number
- **THEN** their profile is reported as complete even with no medical history entered

### Requirement: Profile page in the web app
The patient area SHALL include a profile page for viewing and editing these fields with inline
validation messages. Until the profile is complete, the patient home page MUST prompt the patient
to complete it.

#### Scenario: Incomplete profile prompt
- **WHEN** a patient with an incomplete profile opens the patient home page
- **THEN** a prompt linking to the profile page is shown

#### Scenario: Inline validation
- **WHEN** a patient enters a weight of 0 on the profile page and tries to save
- **THEN** the form shows an error on the weight field and does not submit
