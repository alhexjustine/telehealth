# Spec Delta

## Purpose

Lets a patient ask for a renewal of a prescription from one of their own (or a dependent's) past
completed consultations, and lets the treating doctor approve or deny that request, without
either party booking a new appointment or reopening the original locked record.

## ADDED Requirements

### Requirement: Requesting a refill
A signed-in patient SHALL be able to request a refill of a prescription that belongs to one of
their own completed consultation records, or a completed consultation record of one of their
dependents, with an optional note of at most 500 characters. A prescription MUST NOT have more
than one request with status `PENDING` at a time.

#### Scenario: Patient requests a refill
- **WHEN** a patient requests a refill of a prescription from their own completed consultation, with the note "still symptomatic"
- **THEN** the response is `201` with a `PENDING` request carrying that note

#### Scenario: Requesting for a dependent
- **WHEN** a patient requests a refill of a prescription from a completed consultation booked for one of their dependents
- **THEN** the response is `201` with a `PENDING` request

#### Scenario: Duplicate pending request
- **WHEN** a patient requests a refill of a prescription that already has a `PENDING` request
- **THEN** the response is `409`

#### Scenario: Not the patient's own record
- **WHEN** a patient requests a refill of a prescription belonging to another patient's consultation
- **THEN** the response is `404`

#### Scenario: Consultation not yet completed
- **WHEN** a patient requests a refill of a prescription from a consultation that is not yet `COMPLETED`
- **THEN** the response is `404`

#### Scenario: Signed-out denied
- **WHEN** an unauthenticated client requests a refill
- **THEN** the response is `401`

### Requirement: Doctor decides a refill request
The doctor of the appointment the prescription belongs to SHALL be able to list `PENDING` requests
for their patients, and approve or deny any request that is still `PENDING`, each with an optional
note of at most 500 characters. Deciding SHALL record the decision, the deciding doctor, and the
decision time, and MUST NOT be possible on a request that is not `PENDING`. Approving or denying
MUST NOT modify the original consultation note or create a new prescription entry.

#### Scenario: Doctor approves a request
- **WHEN** the treating doctor approves a `PENDING` refill request with the note "Renewed for another 30 days"
- **THEN** the response is `200` with status `APPROVED`, that note, the doctor, and a decision time, and the original prescription and consultation note are unchanged

#### Scenario: Doctor denies a request
- **WHEN** the treating doctor denies a `PENDING` refill request with a reason
- **THEN** the response is `200` with status `DENIED` and that reason

#### Scenario: Already-decided request
- **WHEN** a doctor tries to approve or deny a request that is already `APPROVED` or `DENIED`
- **THEN** the response is `409`

#### Scenario: Not the treating doctor
- **WHEN** a doctor who is not the appointment's doctor tries to list, approve, or deny a request
- **THEN** the response is `404` for a direct approve/deny attempt, and the request is absent from that doctor's list

#### Scenario: Patient cannot decide their own request
- **WHEN** a patient tries to approve or deny a refill request
- **THEN** the response is `403`

### Requirement: Refill history is scoped per patient/dependent
Access to a refill request MUST follow the same patient/dependent scoping as the underlying
record: a doctor's continuity-of-care relationship with an account holder does not extend to that
account's dependents, and a relationship with one dependent does not extend to another dependent
or to the account holder.

#### Scenario: Dependent's refill request is isolated
- **WHEN** a doctor treats a patient's dependent but has never had an appointment with the patient themselves
- **THEN** listing that doctor's refill requests includes the dependent's requests but not any request belonging to the account holder or another dependent

### Requirement: Refill status visible on the patient record
A prescription's refill request history (status, note, and decision time for each request) SHALL
be visible on the patient's existing record detail view for that consultation, in request order.

#### Scenario: Patient sees a pending request
- **WHEN** a patient with a pending refill request opens that consultation's record
- **THEN** the prescription shows a pending refill request

#### Scenario: Patient sees a decided request
- **WHEN** a patient's refill request has been approved with a note
- **THEN** the prescription shows the approved status and the doctor's note

### Requirement: No administrator access
Administrators MUST NOT be able to read or act on refill requests through any endpoint, consistent
with administrators having no access to clinical content.

#### Scenario: Administrator requests refill data
- **WHEN** an administrator requests any refill-request endpoint
- **THEN** the response is `403`
