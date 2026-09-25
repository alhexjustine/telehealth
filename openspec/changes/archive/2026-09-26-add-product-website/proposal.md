# Proposal

## Why

The public landing page is the first thing visitors and evaluators see. It has to explain what the
service does and how it works, route people clearly into patient registration, doctor
registration, or sign-in, and establish trust, which matters most in a healthcare product. The
brief requires a responsive, self-contained product website with a fictional-prototype
disclaimer, privacy and safety messaging, and application-managed terms and privacy pages, with
no external CMS, analytics, form, image, or marketing service.

## What Changes

- The landing page replaces the current placeholder at `/`. It has these sections:
  - a hero with the value proposition and primary calls to action
  - what you can do: find care, guided matching, booking, the consultation workspace, and records
  - how it works, in patient steps
  - a section for doctors
  - the specializations offered, from the live catalog
  - trust, privacy, and safety
  - FAQ
- A header on every public page with Sign in, Register as a patient, and Join as a doctor, which
  becomes "Go to my dashboard" for signed-in users. It collapses into a menu on small screens.
- Trust messaging:
  - a visible fictional-prototype disclaimer on the landing page and on the registration pages
  - a "not for emergencies" notice
  - privacy and safety explanations that match how the app actually works (hashed passwords,
    server-side sessions, role-based access, no admin access to clinical notes, no third-party
    services)
- `/terms` and `/privacy` pages with application-managed content. They are linked from the
  footer and from the registration forms.
- A not-found page for unknown routes.
- Every copy text, icon, illustration, and font is served by the application. A build check fails
  if the built web app references any external host.
- Accessibility: semantic landmarks, a skip link, keyboard-operable navigation, AA contrast,
  respect for reduced-motion preferences, and automated accessibility checks.
- Documentation: the Product Website module page and L3 and L2 notes.

No external SaaS, CMS, analytics, font, image, or form service is introduced. The new dependency
is a self-hosted open-source font package (`@fontsource-variable/inter`) plus an open-source
accessibility test helper (dev only).

**Product modules affected:** Product Website. The Patient and Doctor registration pages gain the
disclaimer and terms links.

## Capabilities

### New Capabilities
- `product-website`: The public landing page content and calls to action, the public navigation,
  trust and safety messaging, the terms and privacy pages, the not-found page, the self-contained
  asset rule, and the responsiveness and accessibility requirements for public pages.

### Modified Capabilities
<!-- None. The auth registration requirements are unchanged; the disclaimer and terms links are
     product-website requirements that apply to those pages. -->

## Impact

- Web: new `routes/public/*` pages, a `content/` module holding all public copy, a public
  layout (header and footer), illustrations as local SVG components, a self-hosted font, and a
  `check-no-external-urls` build script wired into CI.
- API: none. The specializations section uses the existing public `GET /api/specializations`.
- Documentation: `docs/modules/product-website.md` completed.
