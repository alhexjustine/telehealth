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
- the doctor's average rating computed only from visible reviews (absent if the doctor has none)
  and the count of visible reviews (`0` if none)
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

#### Scenario: Rating shown when reviews exist
- **WHEN** a signed-in patient searches doctors and an approved doctor has three visible reviews averaging 4.5
- **THEN** that doctor's result includes an average rating of 4.5 and a review count of 3

#### Scenario: No reviews yet
- **WHEN** an approved doctor has no visible reviews
- **THEN** that doctor's result has no average rating and a review count of `0`

#### Scenario: Hidden reviews excluded from search results
- **WHEN** an approved doctor has one visible and one hidden review
- **THEN** that doctor's average rating and review count in search results reflect only the visible review

### Requirement: Sorting and pagination
Search results SHALL be sorted by soonest next available slot by default, with doctors who have no
slot last and ties broken by display name. Alternative sorts by display name, by years of
experience (most first), or by average rating (highest first, doctors with no reviews last, ties
broken by display name) SHALL be supported. The rating sort is opt-in only — it MUST NOT be applied
unless explicitly requested, and MUST NOT influence the deterministic specialty-matching results
used elsewhere. Results SHALL be paginated with a page number and a page size (default 12, maximum
50), and the response SHALL include the total number of matches.

#### Scenario: Default sort
- **WHEN** three approved doctors have next slots tomorrow, today, and none
- **THEN** they are returned in the order: today, tomorrow, none

#### Scenario: Pagination
- **WHEN** 15 doctors match and the patient requests page 2 with page size 12
- **THEN** the response contains the last 3 doctors and a total of 15

#### Scenario: Sort by rating
- **WHEN** a patient sorts by rating and doctors have average ratings of 4.8, 4.2, and no reviews
- **THEN** they are returned in the order: 4.8, 4.2, no reviews

### Requirement: Doctor profile view
The system SHALL let any signed-in user view an approved doctor's profile, which includes:
- display name, specializations with descriptions, and full biography
- years of experience and consultation length
- time zone
- whether the doctor is currently accepting new bookings
- the doctor's average rating computed only from visible reviews (absent if none) and the count of
  visible reviews (`0` if none)
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

#### Scenario: Profile rating reflects only visible reviews
- **WHEN** a signed-in patient opens the profile of a doctor with two visible reviews and one hidden review
- **THEN** the average rating and review count are computed from the two visible reviews only

### Requirement: Find a doctor page
The patient area SHALL include a "Find a doctor" page with:
- a search box that updates the results as the patient types (no separate search button), a
  specialization filter, and an availability range picker: a calendar showing one month at a time
  with arrows to move between months, limited to today and the next 13 days, where the patient
  picks a start and an end day (or a single day), plus an option to clear it for any day
- a sort selector (soonest available, name, experience, or rating) and pagination
- doctor cards showing initials avatar, name, specializations, experience, average rating and
  review count (or "No reviews yet"), and next available time in the patient's local time
- an empty state suggesting guided matching when nothing matches

#### Scenario: Filter from the page
- **WHEN** a patient selects the Dermatology filter on the Find a doctor page
- **THEN** the list shows only dermatologists and the URL reflects the filter so the view can be shared or reloaded

#### Scenario: Search as you type
- **WHEN** a patient types a doctor's name into the search box and pauses
- **THEN** the list updates to matching doctors without pressing a button, and the URL reflects the search

#### Scenario: Pick an availability range
- **WHEN** a patient picks a start and an end day in the availability calendar and applies it
- **THEN** only doctors with at least one available slot between the start of the first day and the end of the last day, in the patient's time zone, are listed, and the URL reflects the range

#### Scenario: No results
- **WHEN** a search on the page returns no doctors
- **THEN** an empty state is shown with a link to guided matching

#### Scenario: Card shows rating
- **WHEN** the Find a doctor page lists a doctor with an average rating of 4.7 from 12 visible reviews
- **THEN** the doctor's card shows "4.7" and "12 reviews"

#### Scenario: Card shows no-reviews state
- **WHEN** the Find a doctor page lists a doctor with no visible reviews
- **THEN** the doctor's card shows "No reviews yet" instead of a rating
