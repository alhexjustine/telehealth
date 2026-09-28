# Spec Delta

## ADDED Requirements

### Requirement: Refill request notifications
When a patient requests a prescription refill, the system SHALL notify the treating doctor with
"Refill requested", in the same transaction as the request. When the doctor decides a refill
request, the system SHALL notify the requesting patient with "Refill request approved" or "Refill
request denied", including the doctor's note if one was given, in the same transaction as the
decision. Each notification SHALL link to the relevant record or refill-request queue entry.

#### Scenario: Doctor notified of a new request
- **WHEN** a patient requests a prescription refill
- **THEN** the treating doctor has one unread "Refill requested" notification linking to the request

#### Scenario: Patient notified of approval
- **WHEN** a doctor approves a refill request with a note
- **THEN** the patient has one unread "Refill request approved" notification containing that note

#### Scenario: Patient notified of denial
- **WHEN** a doctor denies a refill request
- **THEN** the patient has one unread "Refill request denied" notification

#### Scenario: Failed request creates nothing
- **WHEN** a refill request is rejected, for example with a duplicate-pending conflict
- **THEN** no notification is created for anyone
