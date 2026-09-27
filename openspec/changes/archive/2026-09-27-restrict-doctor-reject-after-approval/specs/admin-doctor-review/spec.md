# Spec Delta

## MODIFIED Requirements

### Requirement: Approve or reject
An administrator SHALL be able to approve a doctor, with an optional note, or reject a doctor,
with a required note of 5 to 1000 characters. Approve SHALL be accepted for a doctor whose status
is `PENDING` or `REJECTED`; reject SHALL be accepted only for a doctor whose status is `PENDING`.
A decision requesting the status the doctor already has SHALL be rejected with `409`
`STATUS_UNCHANGED`. Rejecting a doctor whose status is `APPROVED` SHALL be rejected with `409`
`INVALID_VERIFICATION_TRANSITION`; an already-approved doctor MAY only be removed from active
service through the administrator's account-level suspend or deactivate action (see
`admin-users`), never through this decision. Approval makes the doctor visible to patients
immediately. Rejection hides the doctor from patients. Existing appointments of a rejected doctor
are not cancelled automatically; they appear as invalid bookings in appointment oversight.

#### Scenario: Approve a pending doctor
- **WHEN** an administrator approves a pending doctor
- **THEN** the doctor's status becomes `APPROVED` and they appear in doctor search

#### Scenario: Reject with a note
- **WHEN** an administrator rejects a pending doctor with the note "License number could not be matched to the fictional registry"
- **THEN** the doctor's status becomes `REJECTED` with that review note, visible to the doctor on their home page

#### Scenario: Reject without a note
- **WHEN** an administrator rejects a doctor without a note
- **THEN** the response is `400`

#### Scenario: Same decision twice
- **WHEN** an administrator approves a doctor who is already approved
- **THEN** the response is `409` with code `STATUS_UNCHANGED`

#### Scenario: Cannot reject an approved doctor
- **WHEN** an administrator attempts to reject a doctor whose status is `APPROVED`
- **THEN** the response is `409` with code `INVALID_VERIFICATION_TRANSITION`, and the doctor's verification status is unchanged

### Requirement: Doctor review pages in the web app
The admin area SHALL include a review queue with tabs for pending, approved, and rejected doctors,
and a doctor review page showing the full profile, an edit form, and approve and reject actions.
Rejecting requires a note. The reject action SHALL be disabled whenever the doctor's verification
status is not `PENDING`.

#### Scenario: Approve from the review page
- **WHEN** an administrator approves a doctor from the review page
- **THEN** the doctor moves from the pending tab to the approved tab, and a confirmation is shown

#### Scenario: Reject disabled for an approved doctor
- **WHEN** an administrator opens the review page for a doctor whose verification status is `APPROVED`
- **THEN** the Reject action is disabled
