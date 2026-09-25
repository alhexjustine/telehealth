# Spec Delta

## ADDED Requirements

### Requirement: Consultation outcome notification
When a doctor completes a consultation, the system SHALL notify the patient with "Consultation
summary available", in the same transaction as the completion. The notification links to the
record detail page.

#### Scenario: Patient notified on completion
- **WHEN** the doctor completes a consultation
- **THEN** the patient has one unread "Consultation summary available" notification linking to that record, and the doctor receives none
