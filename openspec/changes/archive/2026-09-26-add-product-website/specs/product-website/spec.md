# Spec Delta

## Purpose

Defines the public face of the telehealth app: the landing page, the paths into registration and
sign-in, the trust and legal information, and the rules that keep public pages self-contained,
responsive, and accessible.

## ADDED Requirements

### Requirement: Landing page content
The landing page at `/` SHALL be publicly accessible. It SHALL contain, in this order:
1. A hero stating the value proposition, with the primary call to action to register as a
   patient and a secondary call to action to join as a doctor.
2. A capabilities section covering finding a doctor, guided symptom matching, booking and
   rescheduling, the consultation workspace, and medical records.
3. A "How it works" section with the patient steps: create an account, find the right doctor,
   book a time, meet in the consultation workspace, and review your summary and prescriptions.
4. A section for doctors explaining profile verification, schedule management, and consultation
   notes.
5. The list of specializations, loaded from the application's catalog.
6. A trust, privacy, and safety section.
7. An FAQ section of at least five questions.

#### Scenario: Visitor sees the landing page
- **WHEN** an unauthenticated visitor opens `/`
- **THEN** every listed section is present in order, and the hero shows both calls to action

#### Scenario: Specializations from the catalog
- **WHEN** the landing page loads
- **THEN** the specializations section lists the names in the application's specialization catalog

#### Scenario: Catalog unavailable
- **WHEN** the specialization catalog request fails
- **THEN** the rest of the landing page still renders, and the specializations section shows a short fallback message instead of an error

### Requirement: Public navigation and calls to action
Every public page SHALL have a header with the product name (linking to `/`) and links to Sign
in, Register as a patient, and Join as a doctor. For a signed-in user, those links SHALL be
replaced by a single link to that user's role home page. Every public page SHALL have a footer
with links to the terms page, the privacy page, and the landing page sections.

#### Scenario: Header links for visitors
- **WHEN** an unauthenticated visitor uses the header links
- **THEN** they reach `/login`, `/register/patient`, and `/register/doctor` respectively

#### Scenario: Header for a signed-in user
- **WHEN** a signed-in doctor opens the landing page
- **THEN** the header shows a "Go to my dashboard" link to the doctor home page instead of the sign-in and registration links

### Requirement: Trust, safety, and disclaimer messaging
The landing page, both registration pages, and the sign-in page SHALL show a notice that this is a
fictional prototype: doctors, records, and prescriptions are not real, and it must not be used for
real medical decisions. The landing page SHALL state that the service is not for emergencies and
that visitors with an emergency should contact local emergency services. The trust section SHALL
describe only protections the application actually implements: hashed passwords, server-side
sessions, role-based access control, no administrator access to clinical notes, an audit log of
administrator actions, and no third-party services receiving personal data.

#### Scenario: Disclaimer on registration
- **WHEN** a visitor opens patient or doctor registration
- **THEN** the fictional-prototype notice is visible without scrolling on a 1280×800 screen

#### Scenario: Emergency notice
- **WHEN** a visitor reads the landing page
- **THEN** a notice states that the service is not for emergencies and advises contacting local emergency services

### Requirement: Terms and privacy pages
The application SHALL serve `/terms` and `/privacy` from its own content, each showing a "last
updated" date. The privacy page SHALL describe:
- which personal and health data the app stores
- that data stays in the application's own database
- who can access which data (patient, treating doctor, administrator without clinical access)
- how sessions work
- that no data is shared with third parties
- that all data is fictional
Both registration forms SHALL link to both pages next to the submit button.

#### Scenario: Privacy page content
- **WHEN** a visitor opens `/privacy`
- **THEN** the page covers stored data, storage location, access by role, sessions, no third-party sharing, and fictional data, with a last-updated date

#### Scenario: Links from registration
- **WHEN** a visitor views either registration form
- **THEN** links to `/terms` and `/privacy` appear next to the submit button

### Requirement: Not-found page
Any unknown route SHALL show a not-found page with links to the landing page and, for signed-in
users, to their role home page.

#### Scenario: Unknown route
- **WHEN** a visitor opens `/no-such-page`
- **THEN** a not-found page with a link back to the landing page is shown

### Requirement: Self-contained public assets
All public page copy, images, illustrations, icons, and fonts SHALL be bundled with and served by
the application. The built web application MUST NOT reference any external host for scripts,
styles, fonts, images, or data, and loading any public page MUST NOT trigger requests to any
origin other than the application's own.

#### Scenario: Build contains no external references
- **WHEN** the web application is built and the output is checked
- **THEN** the check passes only if no file references an external host (XML namespace identifiers excepted), and CI runs this check

#### Scenario: No third-party requests at runtime
- **WHEN** the landing page is loaded in a browser
- **THEN** every network request goes to the application's own origin

### Requirement: Responsive and accessible public pages
Public pages SHALL render without horizontal scrolling at viewport widths from 360 to 1920 pixels,
with the header collapsing into a keyboard-operable menu below 768 pixels. Public pages SHALL:
- use semantic landmarks (header, nav, main, footer) with one `h1` per page
- provide a skip-to-content link
- meet WCAG 2.1 AA color contrast
- have visible focus indicators
- avoid non-essential motion when the user prefers reduced motion
- pass automated accessibility checks with no serious or critical violations

#### Scenario: Mobile menu
- **WHEN** a visitor on a 375-pixel-wide screen opens the header menu with the keyboard
- **THEN** the menu opens, its links are reachable with Tab, and Escape closes it and returns focus to the menu button

#### Scenario: Automated accessibility check
- **WHEN** the automated accessibility check runs against the landing, terms, privacy, and not-found pages
- **THEN** it reports no serious or critical violations
