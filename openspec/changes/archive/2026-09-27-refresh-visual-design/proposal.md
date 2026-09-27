# Proposal

## Why

The web app works, but it looks like an unstyled shadcn/ui starter: the patient home page is a
row of bare underlined links, cards blend into the page, and every screen shares one flat type
style. The brief evaluates product and design sense, so the prototype should look like a
considered product. The redesign was mocked up and reviewed first (the "Hey Doc UI Redesign"
canvas); this change applies it to `apps/web`. Review of the mockup added two requests: a logo
that reads as "Hey Doc" instead of a generic plus sign, and a public header with only Sign in,
since the landing hero already has the registration calls to action.

## What Changes

- **Design tokens** (`apps/web/src/index.css`): a warm off-white page background with white cards
  on top, warm greys for borders and muted text, and one new warm accent (`warm` /
  `warm-foreground`) for attention states. The teal primary (`#0f6e63`) is unchanged. Dark mode
  keeps its palette and gains matching warm tokens. Every text/background pair still meets WCAG AA,
  enforced by `color-contrast.test.ts`.
- **Typography**: Fraunces for `h1`/`h2` and display text, Public Sans for body text, replacing
  Inter. Both are self-hosted through `@fontsource-variable/*` packages (open-source, OFL-1.1) and
  bundled by Vite, so public pages stay free of external requests.
- **Shared components**: Button, Card, Badge and Input get larger radii, a soft card shadow, and
  44px default buttons and inputs; the hand-styled selects on Find a doctor match them.
- **New logo**: the plain "+" square becomes a Hey Doc mark, a speech bubble ("Hey") holding a
  heartbeat pulse line ("Doc"), used in both headers and as the favicon.
- **Public header**: visitors see only the logo and **Sign in**; the landing hero already carries
  the two registration calls to action. Register as a patient and Join as a doctor move to the
  footer's Account column, so they stay one click away on terms, privacy, sign-in, and not-found
  pages. With one link left the header fits at 360px, so the collapsed mobile menu is removed.
  **BREAKING** for the `product-website` header and mobile-menu scenarios, which change accordingly.
- **Role area header**: the new logo and wordmark, a white header bar, and an active-page indicator
  on the current nav item (`aria-current="page"`).
- **Patient home**: the four bare links become icon cards with a one-line description each, and
  the complete-your-profile prompt becomes a card with a button-styled link. Same four
  destinations, same labels, same prompt condition.
- **Find a doctor**: restyled filter panel and result cards, with the same result fields and single
  next-available slot. The search box now updates results as the patient types (no Search button),
  and the "Available" presets (today, next 3/7/14 days) become an "Available on" range calendar
  (one month at a time, arrows between months) limited to the 14-day search window. **BREAKING** for the `doctor-discovery` page requirement, which names
  the presets.
- **Account menu**: Profile moves out of the nav bar into the avatar menu; "Sign out of all
  devices" moves from that menu to a Security card on the Profile page, so the menu is just Profile
  and Sign out while the all-devices option stays available.
- **Admin doctor review**: a summary card (initials avatar, name, status badges, email, audit link,
  actions). When the doctor is approved, a short note beside the disabled actions points to Users
  for suspension or deactivation, which is the only path the current rules allow.
- **Not changed**: routes, API calls, data shown, form fields and validation, landing page section
  order, copy, and the role areas' mobile menu.
- No external SaaS/BaaS/runtime API is introduced. The new dependencies are open-source libraries
  bundled at build time: two font packages (`@fontsource-variable/fraunces`,
  `@fontsource-variable/public-sans`, OFL-1.1) and `react-day-picker` (MIT) for the calendar;
  `@fontsource-variable/inter` is removed.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `product-website`: "Public navigation and calls to action" (header keeps only Sign in; the
  registration links move to the footer) and "Responsive and accessible public pages" (no
  collapsed header menu; the "Mobile menu" scenario now asserts the header links are visible at 375px with no menu button).
- `doctor-discovery`: "Find a doctor page" (search as you type; an availability calendar replaces
  the presets; new "Search as you type" and "Pick an availability range" scenarios).

Everything else is a visual restyle with no behavior change. The existing requirements it must
keep satisfying are listed in design.md.

## Impact

- **Affected modules:** Product Website (header, footer, logo), and Patient, Doctor, and Admin,
  which all take the new tokens, shared components, and logo. Bespoke layout work is limited to the
  two headers, patient home, Find a doctor, and the admin doctor review page.
- **Code:** `apps/web/src/index.css`, `apps/web/src/components/ui/{button,card,badge,input}.tsx`,
  a new `apps/web/src/components/brand-mark.tsx`, `apps/web/public/favicon.svg`,
  `apps/web/src/routes/layouts/{role-area-layout,public-layout}.tsx`,
  `apps/web/src/routes/patient/{home,doctors}.tsx`, `apps/web/src/routes/admin/doctor-detail.tsx`,
  `apps/web/package.json` + `pnpm-lock.yaml` (font packages).
- **Tests:** `color-contrast.test.ts` (new token values and pairs); `public-layout.test.tsx`
  ("Header links for visitors" updated, "Registration links in the footer" added, "Mobile menu"
  rewritten for the menu-less header); new unit tests for the role header's active nav item and
  the admin approved-doctor note; existing web and e2e tests must keep passing.
- **Docs:** `docs/modules/product-website.md` (fonts, header and footer links, logo).
- **API:** none; the OpenAPI client is untouched.
