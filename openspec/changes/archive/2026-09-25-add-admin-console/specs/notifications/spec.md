# Spec Delta

## ADDED Requirements

### Requirement: Verification decision notifications
When an administrator approves or rejects a doctor, the system SHALL notify that doctor in the
same transaction as the decision. An approval says the profile is now visible to patients. A
rejection includes the review note.

#### Scenario: Doctor notified of approval
- **WHEN** an administrator approves a pending doctor
- **THEN** the doctor has one unread "Profile approved" notification

#### Scenario: Doctor notified of rejection
- **WHEN** an administrator rejects a doctor with a note
- **THEN** the doctor has one unread "Profile not approved" notification containing the note

### Requirement: Administrative cancellation notifications
When an appointment is cancelled by an administrator, or because a participant's account was
deactivated, the system SHALL notify every participant whose account is still active, in the same
transaction. The notification states that the cancellation was made by the platform, and gives the
reason.

#### Scenario: Admin cancellation notifies both
- **WHEN** an administrator cancels an appointment with a reason
- **THEN** both the patient and the doctor receive "Appointment cancelled" stating it was cancelled by the platform, with the reason

#### Scenario: Deactivation notifies the counterpart only
- **WHEN** a doctor's account is deactivated and their upcoming appointments are cancelled
- **THEN** each affected patient is notified, and the deactivated doctor is not
