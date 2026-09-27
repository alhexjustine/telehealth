# Spec Delta

## ADDED Requirements

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
