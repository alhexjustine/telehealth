# Spec Delta

## MODIFIED Requirements

### Requirement: Public navigation and calls to action
Every public page SHALL have a header with the product name and logo (linking to `/`) and a link
to Sign in. For a signed-in user, the Sign in link SHALL be replaced by a single link to that
user's role home page. Every public page SHALL have a footer with links to the terms page, the
privacy page, the landing page sections, Register as a patient, and Join as a doctor, so
registration stays reachable from every public page, not only from the landing page's calls to
action.

#### Scenario: Header links for visitors
- **WHEN** an unauthenticated visitor opens any public page
- **THEN** the header shows the product name linking to `/` and a Sign in link to `/login`, and no registration links

#### Scenario: Header for a signed-in user
- **WHEN** a signed-in doctor opens the landing page
- **THEN** the header shows a "Go to my dashboard" link to the doctor home page instead of the sign-in link

#### Scenario: Registration links in the footer
- **WHEN** an unauthenticated visitor uses the footer's registration links
- **THEN** they reach `/register/patient` and `/register/doctor` respectively

### Requirement: Responsive and accessible public pages
Public pages SHALL render without horizontal scrolling at viewport widths from 360 to 1920 pixels.
The header's links SHALL stay visible and keyboard-reachable at every width in that range, without
a collapsed menu. Public pages SHALL:
- use semantic landmarks (header, nav, main, footer) with one `h1` per page
- provide a skip-to-content link
- meet WCAG 2.1 AA color contrast
- have visible focus indicators
- avoid non-essential motion when the user prefers reduced motion
- pass automated accessibility checks with no serious or critical violations

#### Scenario: Mobile menu
- **WHEN** a visitor on a 375-pixel-wide screen tabs through the header
- **THEN** the product name link and the Sign in link are both visible and receive focus in order, with no menu button and no horizontal scrolling

#### Scenario: Automated accessibility check
- **WHEN** the automated accessibility check runs against the landing, terms, privacy, and not-found pages
- **THEN** it reports no serious or critical violations
