# Spec Delta

## Purpose

Proves the modules work together for real users in a real browser against the real containerized
stack, and keeps the specs honest by requiring a test for every specified scenario.

## ADDED Requirements

### Requirement: Automated core journey
The repository SHALL include an automated browser test that runs against the Docker Compose stack
and completes the core journey across all roles:
1. A visitor registers as a doctor and sets a schedule.
2. The administrator approves that doctor.
3. A visitor registers as a patient, completes their profile, and uses Find care to reach that
   doctor.
4. The patient books and reschedules, and the doctor receives the booking and reschedule
   notifications.
5. Both participants join the consultation, and the doctor starts it, writes a note and a
   prescription, and completes it.
6. The patient views the record.
7. The administrator sees the related audit entries.
CI SHALL run it on every push and pull request.

#### Scenario: Journey passes
- **WHEN** the browser test suite runs against a freshly built stack
- **THEN** the core journey test passes end to end

#### Scenario: Journey failure fails CI
- **WHEN** any step of the core journey fails
- **THEN** the CI run fails, and the browser test report is available as a build artifact

### Requirement: Cross-cutting browser checks
The browser test suite SHALL also verify:
- loading the landing page makes no requests to any origin other than the application's
- the landing, terms, privacy, sign-in, and registration pages have no horizontal scrolling at a
  360-pixel viewport width
- the landing page, sign-in, the patient home page, Find care, the consultation workspace, and the
  admin dashboard have no serious or critical automated accessibility violations

#### Scenario: Third-party request detected
- **WHEN** any page load in the suite requests a resource from another origin
- **THEN** the check fails, naming the request

#### Scenario: Narrow viewport
- **WHEN** the public pages are loaded at 360 pixels wide
- **THEN** none of them is wider than the viewport

### Requirement: Scenario-to-test traceability
CI SHALL fail if any scenario in `openspec/specs` has no automated test whose name contains the
scenario's title. The only exception is a scenario listed in a manual-verification register,
together with how it was verified and why it cannot reasonably be automated. The check SHALL
report every missing scenario with its capability.

#### Scenario: Missing test
- **WHEN** a scenario is added to a spec without a matching test name and without a register entry
- **THEN** the traceability check fails and names the scenario and its capability

#### Scenario: Registered manual scenario
- **WHEN** a scenario has no automated test but is listed in the manual-verification register with a justification
- **THEN** the traceability check passes for that scenario
