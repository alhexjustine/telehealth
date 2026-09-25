# Spec Delta

## Purpose

Lets administrators verify fictional doctor profiles before patients can see them, and correct
doctor profile and specialization data, without any external verification service.

## ADDED Requirements

### Requirement: Review queue
An administrator SHALL be able to list doctor profiles filtered by verification status (default
`PENDING`), oldest submission first. The administrator SHALL be able to open any doctor's full
profile, including email, license number, specializations, biography, experience, consultation
length, account status, verification status, and review note.

#### Scenario: Pending queue
- **WHEN** an administrator opens the review queue with no filter
- **THEN** only pending doctors are listed, the longest-waiting first

#### Scenario: Full profile for review
- **WHEN** an administrator opens a pending doctor's profile
- **THEN** the response includes the doctor's email and license number

#### Scenario: Non-admin denied
- **WHEN** a signed-in doctor or patient calls any doctor review endpoint
- **THEN** the response is `403`

### Requirement: Approve or reject
An administrator SHALL be able to approve a doctor, with an optional note, or reject a doctor,
with a required note of 5 to 1000 characters. Only doctors whose status differs from the decision
SHALL be accepted. Approval makes the doctor visible to patients immediately. Rejection hides the
doctor from patients. Existing appointments of a rejected doctor are not cancelled automatically;
they appear as invalid bookings in appointment oversight.

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

### Requirement: Admin edits to doctor profiles
An administrator SHALL be able to update a doctor's names, specializations, biography, years of
experience, license number, and consultation length, under the same validation rules as the
doctor's own profile update. Admin edits MUST NOT change the verification status.

#### Scenario: Correct a specialization
- **WHEN** an administrator replaces an approved doctor's specializations with Cardiology
- **THEN** the profile shows Cardiology only, and the doctor stays `APPROVED`

#### Scenario: Invalid admin edit
- **WHEN** an administrator submits a consultation length of 25 minutes for a doctor
- **THEN** the response is `400` and nothing changes

### Requirement: Doctor review pages in the web app
The admin area SHALL include a review queue with tabs for pending, approved, and rejected doctors,
and a doctor review page showing the full profile, an edit form, and approve and reject actions.
Rejecting requires a note.

#### Scenario: Approve from the review page
- **WHEN** an administrator approves a doctor from the review page
- **THEN** the doctor moves from the pending tab to the approved tab, and a confirmation is shown
