# Spec Delta

## Purpose

Lets a signed-in patient bookmark doctors they want to find again quickly, and see that list
enriched with each doctor's current discovery-card summary, without affecting how doctor search
itself ranks or filters results.

## ADDED Requirements

### Requirement: Favorite a doctor
A signed-in patient SHALL be able to favorite an approved, active doctor. Favoriting the same
doctor again while already favorited SHALL be a no-op that returns the existing favorite rather
than an error. A patient MUST NOT be able to favorite more than 50 doctors at once.

#### Scenario: Favorite an approved doctor
- **WHEN** a patient favorites an approved, active doctor they haven't favorited before
- **THEN** the response is `201` and the doctor appears in the patient's favorites list

#### Scenario: Favoriting again is a no-op
- **WHEN** a patient favorites a doctor they have already favorited
- **THEN** the response is `200` with the existing favorite, and no duplicate is created

#### Scenario: Cannot favorite a hidden doctor
- **WHEN** a patient tries to favorite a doctor who is pending, rejected, suspended, or not active
- **THEN** the response is `404`

#### Scenario: Favorite limit reached
- **WHEN** a patient who already has 50 favorited doctors tries to favorite another
- **THEN** the response is `409` with code `FAVORITE_LIMIT_REACHED`

#### Scenario: Non-patient denied
- **WHEN** a signed-in doctor or administrator tries to favorite a doctor
- **THEN** the response is `403`

#### Scenario: Signed-out denied
- **WHEN** an unauthenticated client tries to favorite a doctor
- **THEN** the response is `401`

### Requirement: Unfavorite a doctor
A signed-in patient SHALL be able to unfavorite a doctor they previously favorited. Unfavoriting a
doctor that isn't currently favorited SHALL also succeed as a no-op, so the client doesn't need to
know the current state before acting.

#### Scenario: Unfavorite a favorited doctor
- **WHEN** a patient unfavorites a doctor they had favorited
- **THEN** the response is `200` and the doctor no longer appears in the patient's favorites list

#### Scenario: Unfavoriting an unfavorited doctor is a no-op
- **WHEN** a patient unfavorites a doctor they never favorited (or already unfavorited)
- **THEN** the response is `200` and nothing changes

#### Scenario: Signed-out denied
- **WHEN** an unauthenticated client tries to unfavorite a doctor
- **THEN** the response is `401`

### Requirement: List favorited doctors
A signed-in patient SHALL be able to list their favorited doctors. Each entry SHALL include the
same summary fields as a doctor-discovery search result (display name, specializations, years of
experience, whether the doctor is accepting new bookings, and the next available slot within 14
days, or none), plus when the doctor was favorited. A doctor who was favorited but has since become
not approved or not active SHALL be silently excluded from this list, mirroring doctor-discovery's
existing "only approved, active doctors" visibility rule — the omission is not surfaced as an
error or a broken entry.

#### Scenario: List favorites with live summaries
- **WHEN** a patient with two favorited doctors, one of them not currently accepting bookings, lists their favorites
- **THEN** both appear, each with their current discovery-card summary, and the non-accepting doctor's `acceptingBookings` is `false` with no next-available time

#### Scenario: Favorite doctor no longer visible
- **WHEN** a patient favorited a doctor who has since been suspended
- **THEN** that doctor is silently omitted from the favorites list

#### Scenario: Empty favorites
- **WHEN** a patient with no favorited doctors lists their favorites
- **THEN** the response is `200` with an empty list

#### Scenario: Signed-out denied
- **WHEN** an unauthenticated client lists favorites
- **THEN** the response is `401`

### Requirement: Favoriting has no effect on doctor search
Favoriting or unfavoriting a doctor SHALL NOT change that doctor's position, inclusion, or any
field in doctor-discovery search results, sorting, or the deterministic specialty-matching
algorithm. Favorite state is visible only through the favorites endpoints and as a per-doctor
toggle state in the web app.

#### Scenario: Favoriting does not reorder search results
- **WHEN** a patient favorites a doctor and then searches or browses doctors with the same filters as before
- **THEN** the search results are unchanged in order, inclusion, and content

### Requirement: Favorites in the web app
The patient area SHALL include a "My favorites" page listing favorited doctors as cards (matching
the Find a doctor page's card layout) with a "Book" shortcut into that doctor's profile. The
doctor's discovery card and profile page SHALL each show a toggleable favorite control reflecting
current favorite state.

#### Scenario: Favorite from a search result card
- **WHEN** a patient toggles the favorite control on a doctor's card in Find a doctor
- **THEN** the control reflects the new state immediately and the doctor appears in My favorites

#### Scenario: Unfavorite from My favorites
- **WHEN** a patient unfavorites a doctor from the My favorites page
- **THEN** that doctor's card is removed from the page

#### Scenario: Book from My favorites skips search
- **WHEN** a patient selects "Book" on a favorited doctor's card
- **THEN** they land directly on that doctor's profile page with its slot picker, without visiting Find a doctor
