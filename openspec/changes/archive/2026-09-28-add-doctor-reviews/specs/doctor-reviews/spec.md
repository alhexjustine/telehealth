# Spec Delta

## Purpose

Lets a patient account rate and comment on a doctor after a completed consultation, lets any
signed-in user see a doctor's visible reviews and aggregate rating, and lets an administrator
moderate individual reviews.

## ADDED Requirements

### Requirement: Rate a completed consultation

The account holder who booked an appointment SHALL be able to leave a rating (an integer 1 to 5)
and an optional comment (at most 1000 characters) for the appointment's doctor, once that
appointment's status is `COMPLETED`. Eligibility SHALL use the same rule as reading that
appointment's own record: the caller MUST be the appointment's own patient (the account, whether
the appointment was for the account holder or a dependent) and the appointment MUST be
`COMPLETED`. Submitting again for the same appointment SHALL replace the account's existing
rating and comment for it, not create a second review — there is at most one review per
appointment.

#### Scenario: Leave a review after completion
- **WHEN** a patient submits a rating of 5 and a comment for their own completed appointment
- **THEN** the review is stored with that rating and comment, tied to the appointment and its doctor

#### Scenario: Edit an existing review
- **WHEN** a patient who already reviewed a completed appointment submits a different rating and comment for the same appointment
- **THEN** the stored review is replaced with the new rating and comment, and no second review exists

#### Scenario: Not yet completed
- **WHEN** a patient tries to review an appointment that is still `BOOKED`, `CANCELLED`, or `NOT_HELD`
- **THEN** the response is `409` with code `REVIEW_NOT_ELIGIBLE`, and no review is stored

#### Scenario: Rating out of range
- **WHEN** a patient submits a rating of 0 or 6 for a completed appointment
- **THEN** the response is `400` and no review is stored

#### Scenario: Comment too long
- **WHEN** a patient submits a comment longer than 1000 characters
- **THEN** the response is `400` and no review is stored

#### Scenario: Not the account's own appointment
- **WHEN** a patient tries to review another account's completed appointment, or a doctor tries to review any appointment
- **THEN** the response is `404`

#### Scenario: Signed-out denied
- **WHEN** an unauthenticated client tries to submit a review
- **THEN** the response is `401`

### Requirement: View a doctor's reviews

Any signed-in user SHALL be able to view a paginated list of a doctor's visible (non-hidden)
reviews, newest first, each with its rating, comment, and submission time, and the doctor's
average rating and review count computed only from visible reviews. A hidden review MUST NOT
appear in this list or contribute to the average or count. The reviewer's identity (the account,
or which dependent the appointment was for) MUST NOT be exposed by this view.

#### Scenario: List visible reviews
- **WHEN** a signed-in user requests a doctor's reviews and three visible reviews exist
- **THEN** all three are returned, newest first, without any reviewer identity

#### Scenario: Hidden review excluded
- **WHEN** an administrator has hidden one of a doctor's four reviews
- **THEN** the doctor's review list shows the remaining three, and the average rating and review count reflect only those three

#### Scenario: No reviews yet
- **WHEN** a doctor has no visible reviews
- **THEN** the average rating is absent (not zero) and the review count is `0`

#### Scenario: Signed-out denied
- **WHEN** an unauthenticated client requests a doctor's reviews
- **THEN** the response is `401`

### Requirement: Review moderation

An administrator SHALL be able to list every review, including hidden ones, filtered by doctor and
by hidden status. An administrator SHALL be able to hide or unhide a specific review with a
required reason of 5 to 500 characters. Hiding a review already hidden, or unhiding a review that
is not hidden, SHALL be rejected with `409` and code `REVIEW_HIDE_STATUS_UNCHANGED`. Hiding or
unhiding takes effect immediately for the public view described above.

#### Scenario: Hide a review
- **WHEN** an administrator hides a review with reason "Contains another patient's name"
- **THEN** the review is hidden with that reason, and it immediately stops appearing in the public list and aggregate

#### Scenario: Unhide a review
- **WHEN** an administrator unhides a previously hidden review with a reason
- **THEN** the review is visible again and counted in the public aggregate

#### Scenario: Missing reason
- **WHEN** an administrator hides or unhides a review without a reason
- **THEN** the response is `400` and the review's hidden status is unchanged

#### Scenario: Redundant hide
- **WHEN** an administrator hides a review that is already hidden
- **THEN** the response is `409` with code `REVIEW_HIDE_STATUS_UNCHANGED`

#### Scenario: Non-admin denied
- **WHEN** a signed-in patient or doctor calls any review-moderation endpoint
- **THEN** the response is `403`
