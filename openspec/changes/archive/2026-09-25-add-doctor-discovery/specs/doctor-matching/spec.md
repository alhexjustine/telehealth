# Spec Delta

## Purpose

Guides patients who only know their symptoms to suitable specializations and doctors, using
deterministic, explainable rules stored in the application, and warns them when symptoms may need
emergency care.

## ADDED Requirements

### Requirement: Symptom catalog
The system SHALL ship a symptom catalog as reference data present in every environment without a
separate seeding step. Each symptom SHALL have:
- a stable ID, a unique slug, a patient-friendly name, and a category
- a list of keywords
- an emergency ("red flag") marker
- one or more links to specializations, each with a weight from 1 to 3
The catalog MUST contain at least 40 symptoms spread across at least 8 categories. It MUST include
these symptoms with exactly these keywords and specialization links (other symptoms may reuse the
same specializations):
- Headache: keywords "headache", "migraine"; Neurology 3, General Practice 1
- Skin rash: keywords "rash", "hives", "itchy skin"; Dermatology 3
- Cough: keywords "cough", "coughing"; Pulmonology 2, General Practice 2
- Chest pain (red flag): keywords "chest pain", "chest tightness"; Cardiology 3
- Anxiety: keywords "anxiety", "anxious", "panic"; Psychiatry 3
It MUST also include these red flags:
- difficulty breathing
- severe bleeding
- sudden weakness or numbness on one side
- sudden severe headache
- thoughts of self-harm
- loss of consciousness
- seizure
- swelling of the face or throat

#### Scenario: Catalog available after migration
- **WHEN** the database has been migrated on a fresh installation
- **THEN** the catalog contains at least 40 symptoms including the rules and red flags listed above

### Requirement: Symptom listing
The system SHALL let any signed-in user list the symptom catalog, grouped by category and sorted by
name. Each symptom SHALL include its ID, slug, name, category, and red-flag marker. Keywords and
weights MUST NOT be exposed.

#### Scenario: Patient lists symptoms
- **WHEN** a signed-in patient requests the symptom list
- **THEN** the response is `200` with symptoms grouped by category, and no keywords or weights are exposed

#### Scenario: Signed-out denied
- **WHEN** an unauthenticated client requests the symptom list
- **THEN** the response is `401`

### Requirement: Matching request
A signed-in patient SHALL be able to request matching with zero or more symptom IDs from the
catalog and an optional free-text description of at most 1000 characters. At least one of them
MUST be provided.

#### Scenario: Neither symptoms nor description
- **WHEN** a patient submits matching with no symptom IDs and no description
- **THEN** the response is `400`

#### Scenario: Unknown symptom
- **WHEN** a patient submits a symptom ID that is not in the catalog
- **THEN** the response is `400`

#### Scenario: Non-patient denied
- **WHEN** a signed-in doctor or administrator submits a matching request
- **THEN** the response is `403`

### Requirement: Deterministic matching algorithm
Matching SHALL work as follows:
1. Symptoms from the request are marked "selected". Symptoms whose keyword appears in the
   description as a whole word or phrase (case-insensitive, punctuation ignored) are marked
   "described".
2. Each specialization's score is the sum of the weights of its links to the matched symptoms,
   counting each symptom once.
3. When the patient's birthday shows they are under 18, Pediatrics receives a score of 4 above the
   current highest score.
4. When no symptom is matched, General Practice is returned with score 1 and a "no specific match"
   explanation.
5. The top three specializations by score are returned, with ties broken by name.
6. Doctors are approved, active doctors with at least one of those specializations. They are
   ranked by the highest score among their matching specializations, then by soonest next
   available slot within 14 days (none last), then by name. At most 10 are returned.
Every returned specialization and doctor SHALL include the reasons it matched, as pairs of symptom
and specialization. The same request against the same data and time MUST always produce the same
result.

#### Scenario: Selected symptom
- **WHEN** an adult patient selects only Skin rash
- **THEN** Dermatology is the top specialization with the reason "Skin rash → Dermatology", and dermatologists are returned

#### Scenario: Symptom found in the description
- **WHEN** an adult patient submits no symptom IDs and the description "I've had a bad migraine since yesterday."
- **THEN** Headache is matched as "described", Neurology ranks first and General Practice second

#### Scenario: Weights add up
- **WHEN** an adult patient selects Headache and Cough
- **THEN** General Practice scores 3, Neurology 3, and Pulmonology 2, and they are returned in that order (ties broken by name)

#### Scenario: Under-18 patient
- **WHEN** a patient whose birthday makes them 12 years old selects Cough
- **THEN** Pediatrics is the top specialization, with an age-based reason

#### Scenario: No match
- **WHEN** an adult patient submits only the description "I just don't feel right"
- **THEN** General Practice is returned with a "no specific match" explanation, along with general practitioners

#### Scenario: Deterministic result
- **WHEN** the same patient submits the same matching request twice with no data changes in between
- **THEN** both responses list the same specializations and doctors in the same order

### Requirement: Emergency warning
When any matched symptom is a red flag, the matching response SHALL be marked urgent. It SHALL
include an emergency message advising the patient to contact local emergency services immediately
and naming the red-flag symptoms. Specializations and doctors SHALL still be returned.

#### Scenario: Red flag selected
- **WHEN** a patient selects Chest pain
- **THEN** the response is marked urgent with the emergency message naming Chest pain, and Cardiology is still returned

#### Scenario: Red flag described
- **WHEN** a patient's description contains "difficulty breathing"
- **THEN** the response is marked urgent

### Requirement: Find care page
The patient area SHALL include a "Find care" page where the patient picks symptoms from the catalog
(grouped by category, searchable) and optionally describes them, then sees:
- the matched symptoms
- the top specializations with their reasons
- the ranked doctors with reasons and next available time, each linking to the doctor profile page
The page MUST state that results are guidance and not a diagnosis. For urgent results, a prominent
emergency banner MUST be shown first, and the doctor list MUST stay hidden until the patient
acknowledges the warning.

#### Scenario: Urgent result in the page
- **WHEN** a patient selects Chest pain and submits on the Find care page
- **THEN** an emergency banner is shown and doctors appear only after the patient confirms they have read it

#### Scenario: Disclaimer always shown
- **WHEN** matching results are displayed
- **THEN** a "this is guidance, not a diagnosis" notice is visible
