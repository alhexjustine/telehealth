# ui-resilience Specification

## Purpose
Makes the web app behave predictably and helpfully when data is loading, missing, or failing,
and when a session ends, so that no screen is left blank, stuck, or unexplained.

## Requirements

### Requirement: Loading, empty, and error states
Every page or panel that loads data from the API SHALL show:
- a loading state while the first request is pending
- an empty state with a helpful next step when there is no data
- an error state with a plain-language message and a retry action when the request fails
A failed background refresh MUST NOT replace data that is already displayed with an error screen.

#### Scenario: Request fails
- **WHEN** the appointments list request fails with a server error
- **THEN** an error message with a "Try again" action is shown, and choosing it repeats the request

#### Scenario: Background refresh fails
- **WHEN** appointments are already displayed and a background refresh fails
- **THEN** the displayed appointments stay visible, and a non-blocking notice indicates the refresh failed

#### Scenario: Empty list
- **WHEN** a new patient opens their appointments with none booked
- **THEN** an empty state explains there are no appointments yet and links to Find care

### Requirement: Unexpected error recovery
An unexpected rendering error SHALL show a recovery page with a message, a "Reload" action, and a
link to the user's home page, instead of a blank screen. The error SHALL be logged to the browser
console, with no external reporting service.

#### Scenario: Component crashes
- **WHEN** a page component throws during rendering
- **THEN** the recovery page is shown with Reload and home links, and the rest of the app remains usable after navigating away

### Requirement: Session-ended experience
When a request in a role area fails because the session is no longer valid (expired, signed out
elsewhere, or account suspended), the web app SHALL clear cached data. It SHALL take the user to
the sign-in page with a message that their session has ended, and return them to the page they
were on after they sign in again, subject to the existing return-address rules.

#### Scenario: Session expires while browsing
- **WHEN** a signed-in patient's session expires and they open another page
- **THEN** they land on sign-in with a "Your session has ended. Please sign in again." message, and after signing in they return to that page
