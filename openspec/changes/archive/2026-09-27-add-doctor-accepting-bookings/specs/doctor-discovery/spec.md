# Spec Delta

## MODIFIED Requirements

### Requirement: Doctor search
The system SHALL let any signed-in user search approved doctors, and MUST NOT include doctors
whose verification status is not `APPROVED` or whose account is not active. Each result SHALL
include:
- the doctor's ID, display name, and specializations
- a biography excerpt of at most 200 characters
- years of experience and consultation length
- whether the doctor is currently accepting new bookings
- the start of their next available slot within the next 14 days, or none — always none for a
  doctor who is not accepting new bookings
A doctor who is not accepting new bookings SHALL still be included in an unfiltered or
text/specialization-filtered search, but MUST NOT match an availability-range filter, since they
have no bookable time in any range.

#### Scenario: Only approved, active doctors listed
- **WHEN** a signed-in patient searches with no filters while approved, pending, rejected, and suspended doctors exist
- **THEN** only the approved doctors with active accounts are returned

#### Scenario: Text query
- **WHEN** a patient searches with the query `derma`
- **THEN** approved doctors whose name or any specialization name contains "derma" (case-insensitive) are returned, and others are not

#### Scenario: Specialization filter
- **WHEN** a patient filters by the specialization slug `cardiology`
- **THEN** only approved doctors with the Cardiology specialization are returned

#### Scenario: Availability filter
- **WHEN** a patient filters for doctors available between two instants at most 14 days apart
- **THEN** only doctors with at least one available slot starting in that range are returned

#### Scenario: Invalid filters
- **WHEN** a patient passes an unknown specialization slug, an availability range longer than 14 days, or a page size above 50
- **THEN** the response is `400`

#### Scenario: Signed-out denied
- **WHEN** an unauthenticated client searches doctors
- **THEN** the response is `401`

#### Scenario: Not accepting bookings still listed
- **WHEN** an approved doctor has turned off accepting bookings and a patient searches with no availability filter
- **THEN** the doctor is included, with `acceptingBookings` false and no next-available time

#### Scenario: Not accepting bookings excluded from an availability filter
- **WHEN** an approved doctor has turned off accepting bookings and a patient filters by an availability range
- **THEN** that doctor is not returned, even though their configured weekly hours would otherwise cover the range

### Requirement: Doctor profile view
The system SHALL let any signed-in user view an approved doctor's profile, which includes:
- display name, specializations with descriptions, and full biography
- years of experience and consultation length
- time zone
- whether the doctor is currently accepting new bookings
A doctor MUST be able to view their own profile this way regardless of verification status. Every
other user MUST receive not-found for doctors that are not approved or not active.

#### Scenario: View approved doctor
- **WHEN** a signed-in patient opens an approved doctor's profile
- **THEN** the response contains the profile fields, and no email, license number, or review note

#### Scenario: Hidden doctor
- **WHEN** a signed-in patient requests the profile of a pending, rejected, or suspended doctor, or of an ID that is not a doctor
- **THEN** the response is `404`

#### Scenario: Not accepting bookings shown on profile
- **WHEN** a signed-in patient opens the profile of an approved doctor who has turned off accepting bookings
- **THEN** the response's `acceptingBookings` field is `false`
