# Spec Delta

## ADDED Requirements

### Requirement: Book again from an existing appointment
For each appointment shown on the patient's appointments page (upcoming or past), the patient
area SHALL offer a "Book again" shortcut that opens that same doctor's profile page directly,
skipping Find a doctor's search/filter/guided-matching step, with the same attendee (the account
holder, or the same dependent) the appointment was for preselected on the booking confirmation
page that follows. "Book again" reuses the doctor's existing profile and slot-picker pages — it
MUST NOT create or modify any appointment by itself, and it is subject to the same booking rules
as any other booking (an unavailable, hidden, or no-longer-accepting doctor behaves exactly as it
would from a fresh search).

#### Scenario: Book again preselects the same attendee
- **WHEN** a patient selects "Book again" on a past appointment that was for one of their dependents
- **THEN** they land on that doctor's profile page, and after picking a new slot the booking
  confirmation page has that same dependent preselected as the attendee

#### Scenario: Book again for the account holder
- **WHEN** a patient selects "Book again" on an appointment that was for themselves
- **THEN** the booking confirmation page that follows has "Myself" preselected as the attendee

#### Scenario: Book again with a doctor no longer accepting bookings
- **WHEN** a patient selects "Book again" for a doctor who has since turned off accepting bookings
- **THEN** the doctor's profile page states no times are available, the same as reaching that
  profile through search would

#### Scenario: Book again with a doctor no longer visible
- **WHEN** a patient selects "Book again" for a doctor who has since been suspended or deactivated
- **THEN** the response is `404`, the same as opening that doctor's profile any other way
