# doctor-discovery Specification

## Purpose
Lets signed-in patients find approved doctors by name, specialization, and availability, and view
a doctor's profile and upcoming slots before booking.

## Requirements

### Requirement: Doctor search
The system SHALL let any signed-in user search approved doctors, and MUST NOT include doctors
whose verification status is not `APPROVED` or whose account is not active. Each result SHALL
include:
- the doctor's ID, display name, and specializations
- a biography excerpt of at most 200 characters
- years of experience and consultation length
- the start of their next available slot within the next 14 days, or none

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

### Requirement: Sorting and pagination
Search results SHALL be sorted by soonest next available slot by default, with doctors who have no
slot last and ties broken by display name. Alternative sorts by display name or by years of
experience (most first) SHALL be supported. Results SHALL be paginated with a page number and a
page size (default 12, maximum 50), and the response SHALL include the total number of matches.

#### Scenario: Default sort
- **WHEN** three approved doctors have next slots tomorrow, today, and none
- **THEN** they are returned in the order: today, tomorrow, none

#### Scenario: Pagination
- **WHEN** 15 doctors match and the patient requests page 2 with page size 12
- **THEN** the response contains the last 3 doctors and a total of 15

### Requirement: Doctor profile view
The system SHALL let any signed-in user view an approved doctor's profile, which includes:
- display name, specializations with descriptions, and full biography
- years of experience and consultation length
- time zone
A doctor MUST be able to view their own profile this way regardless of verification status. Every
other user MUST receive not-found for doctors that are not approved or not active.

#### Scenario: View approved doctor
- **WHEN** a signed-in patient opens an approved doctor's profile
- **THEN** the response contains the profile fields, and no email, license number, or review note

#### Scenario: Hidden doctor
- **WHEN** a signed-in patient requests the profile of a pending, rejected, or suspended doctor, or of an ID that is not a doctor
- **THEN** the response is `404`

### Requirement: Find a doctor page
The patient area SHALL include a "Find a doctor" page with:
- a search box, a specialization filter, and an availability filter (today, next 3 days, next 7
  days, next 14 days, any)
- a sort selector and pagination
- doctor cards showing initials avatar, name, specializations, experience, and next available
  time in the patient's local time
- an empty state suggesting guided matching when nothing matches

#### Scenario: Filter from the page
- **WHEN** a patient selects the Dermatology filter on the Find a doctor page
- **THEN** the list shows only dermatologists and the URL reflects the filter so the view can be shared or reloaded

#### Scenario: No results
- **WHEN** a search on the page returns no doctors
- **THEN** an empty state is shown with a link to guided matching

### Requirement: Doctor profile page with slot picker
The patient area SHALL include a doctor profile page. It shows the profile and the doctor's
available slots for the next 14 days, grouped by date and displayed in the patient's local time
zone with the zone named. Selecting a slot shows its date, time, and duration.

#### Scenario: Slots shown in patient time
- **WHEN** a patient whose browser time zone differs from the doctor's opens the doctor profile page
- **THEN** slot times are shown in the patient's time zone, and the time zone is labeled

#### Scenario: No availability
- **WHEN** the doctor has no slots in the next 14 days
- **THEN** the page states that no times are available and suggests other doctors with the same specialization
