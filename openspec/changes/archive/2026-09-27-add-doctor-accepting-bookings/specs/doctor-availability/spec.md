# Spec Delta

## MODIFIED Requirements

### Requirement: Slot visibility
Signed-in users SHALL be able to request the slots of approved doctors. A doctor whose
verification status is not `APPROVED` MUST have their slots hidden from everyone except
themselves. A doctor who has turned off accepting bookings MUST also return no slots to anyone
other than themselves — they still see their own calculated slots for planning purposes.
Unauthenticated clients MUST NOT be able to request slots.

#### Scenario: Patient views an approved doctor's slots
- **WHEN** a signed-in patient requests slots for an approved doctor
- **THEN** the response is `200` with the calculated slots

#### Scenario: Unapproved doctor hidden
- **WHEN** a signed-in patient requests slots for a doctor whose status is pending or rejected, or for an ID that is not a doctor
- **THEN** the response is `404`

#### Scenario: Doctor previews own slots while pending
- **WHEN** a doctor with status pending requests their own slots
- **THEN** the response is `200` with their calculated slots

#### Scenario: Signed-out denied
- **WHEN** an unauthenticated client requests any doctor's slots
- **THEN** the response is `401`

#### Scenario: Slots hidden while not accepting bookings
- **WHEN** a signed-in patient requests slots for an approved doctor who has turned off accepting bookings
- **THEN** the response is `200` with an empty list of slots

#### Scenario: Doctor still previews own slots while not accepting bookings
- **WHEN** a doctor who has turned off accepting bookings requests their own slots
- **THEN** the response is `200` with their calculated slots, unaffected by the toggle
