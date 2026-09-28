# Spec Delta

## ADDED Requirements

### Requirement: New message notification
When a participant sends a message on an appointment, the system SHALL notify the other
participant with "New message", in the same transaction as the message being stored. The
notification SHALL include the appointment ID, the sender's display name, and a link to the
appointment in the recipient's role area. It SHALL NOT include the message body.

#### Scenario: Recipient notified
- **WHEN** a patient sends a message on an appointment
- **THEN** the doctor has one unread "New message" notification naming the patient and linking to the appointment, and the patient receives no notification for their own message

#### Scenario: Failed send creates nothing
- **WHEN** a message send is rejected, for example with `APPOINTMENT_NOT_ACTIVE`
- **THEN** no notification is created for anyone
