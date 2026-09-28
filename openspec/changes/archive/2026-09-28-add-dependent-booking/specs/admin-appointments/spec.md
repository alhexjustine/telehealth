# Spec Delta

## MODIFIED Requirements

### Requirement: Appointment oversight list
An administrator SHALL be able to list all appointments, paginated, filtered by status, by
consultation state, by start date range, by doctor, by patient, and by "invalid only". Each entry
SHALL include the times, both participants' display names, who the appointment is for (the account
holder or a named dependent, with the dependent's relationship), the status, the consultation
state, and any invalid-booking flag. Entries MUST NOT include the reason, symptoms, notes,
prescriptions, or medical history — the account holder's own or any dependent's.

#### Scenario: Filter by date and status
- **WHEN** an administrator lists booked appointments starting this week
- **THEN** only booked appointments in that range are returned, with participants and consultation state

#### Scenario: Attendee shown without dependent medical history
- **WHEN** an administrator lists or opens an appointment booked for a patient's dependent
- **THEN** the entry shows the dependent's name and relationship, but no medical conditions, allergies, or medications for that dependent

#### Scenario: No clinical content
- **WHEN** an administrator lists or opens any appointment
- **THEN** the response contains no reason, symptoms, notes, prescriptions, or medical history

#### Scenario: Non-admin denied
- **WHEN** a signed-in patient or doctor calls any appointment oversight endpoint
- **THEN** the response is `403`
