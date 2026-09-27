# Design

## Context

See proposal.md - Why. `apps/web` is Tailwind v4 + shadcn/ui: every colour is a token in
`index.css`'s `@theme` block (dark mode overrides values in a `:root` block under
`prefers-color-scheme: dark`), and `color-contrast.test.ts` asserts AA contrast against a
hard-coded copy of those hex values. Most screens are built from `components/ui/*`, so tokens and
primitives carry most of the redesign; only four places need layout changes.

Requirements this change modifies are in the `product-website` delta (header links, footer links,
no collapsed public menu). Existing requirements it must keep satisfying unchanged:
- `product-website`: landing sections in their listed order, self-contained public assets (no
  external fonts, styles, scripts, or images), one `h1` per page, semantic landmarks, WCAG 2.1 AA
  contrast, no horizontal scrolling from 360 to 1920px.
- `auth`: each role area has its own navigation, the user's initials avatar, and sign-out.
- `patient-profile`: the patient home page prompts for profile completion until it is complete.
- `admin-doctor-review`: Reject disabled unless `PENDING` (just shipped in
  `restrict-doctor-reject-after-approval`).
- `ui-resilience`: data views keep using `QueryState` (the coverage tripwire test must still pass).

## Goals / Non-Goals

**Goals:**
- Apply the reviewed look (warm neutrals, teal primary, one warm accent, Fraunces + Public Sans,
  white cards with soft shadows) across the whole app through tokens and shared components.
- Rework the four screens where the old layout was weakest: role header, patient home, Find a
  doctor, and admin doctor review.
- Keep AA contrast in both light and dark mode, enforced by the existing test.

**Non-Goals:**
- Features from the mockup that aren't in the app today: multiple slot buttons per search result,
  specialization filter pills replacing the select, breadcrumbs, and an admin badge in the header.
  Each would change behavior or add navigation, so they are out of scope here.
- A manual light/dark toggle; the app keeps following the system preference.
- Restructuring forms (`DoctorProfileFormFields`, patient profile, schedule). They pick up the new
  inputs and buttons but keep their layout and validation.
- Copy changes, apart from the one-line descriptions on the patient home cards and the admin
  approved-doctor note.

## Decisions

- **Warm neutrals, same teal.** The page background becomes `#faf9f6` and cards stay `#ffffff`, so
  cards read as surfaces instead of blending in; borders and muted text shift to warm greys. Primary
  stays `#0f6e63` for continuity and because it already passes AA with white.
  - *Alternative considered:* a new brand hue. Rejected: the teal already reads as calm and
    clinical, and changing it would mean re-deriving every dependent pair for no user benefit.
- **One warm accent token pair** (`--color-warm: #f6e8de`, `--color-warm-foreground: #8a3f17`;
  dark: `#3a2418` / `#f4c7a8`), used only for attention states such as the profile prompt icon.
  - *Alternative considered:* reuse `destructive` for attention states. Rejected: an incomplete
    profile isn't an error, and red would overstate it.
- **Fonts self-hosted via `@fontsource-variable/fraunces` and `@fontsource-variable/public-sans`**,
  imported in `index.css` the same way Inter is today, with `--font-sans` and a new
  `--font-display` token. A base-layer rule applies `font-display` to `h1` and `h2`, and card titles
  opt in with a class.
  - *Alternative considered:* Google Fonts `<link>` (what the mockup used). Rejected: it violates
    `product-website`'s self-contained-assets requirement and fails `check-no-external-urls.mjs`.
  - *Alternative considered:* keep Inter for body text. Rejected: Public Sans is just as legible in
    dense tables and forms and pairs better with a serif display face; with Inter gone there is one
    fewer font to ship.
- **Primitives change in place** (`button.tsx`, `card.tsx`, `badge.tsx`, `input.tsx`): default
  button and input height go from 36px to 44px (`h-11`); `sm` buttons stay compact (`h-9`) for dense
  admin tables. Card uses `bg-card`, `rounded-2xl`, and a `shadow-card` token defined in `@theme`.
  Variant names and props stay the same, so call sites don't change.
  - *Alternative considered:* new variants (e.g. `size="lg"`) that call sites opt into. Rejected: it
    would leave most of the app on the old look and add a variant-per-screen maintenance cost.
- **Logo: a speech bubble holding a pulse line**, teal fill with a white heartbeat stroke, drawn as
  one inline SVG in a new `BrandMark` component (`aria-hidden`; the adjacent "Hey Doc" wordmark is
  the link's accessible name) and reused as `public/favicon.svg`. The bubble says "Hey", the pulse
  says "Doc", and both shapes stay legible at favicon size.
  - *Alternative considered:* a medical cross inside the bubble. Rejected in review: another brand
    already uses a plus/cross in its logo.
  - *Alternative considered:* an "HD" monogram. Rejected: two letters blur at 16px, and a monogram
    says nothing about what the product does.
- **Public header keeps only Sign in; registration moves to the footer.** The landing hero already
  shows both registration calls to action above the fold, so the header repeated them. The footer's
  Account column gains Register as a patient and Join as a doctor, so the terms, privacy, sign-in,
  and not-found pages (which have no hero) still offer registration.
  - *Alternative considered:* drop the registration links from the header with no replacement.
    Rejected: a visitor on the privacy page would have to go back to the landing page to register.
- **No collapsed menu in the public header.** Logo plus one link (or "Go to my dashboard") fits at
  360px, and a menu button hiding a single link only adds a tap. The role areas keep their `Sheet`
  menu, which still holds four or five links.
  - *Alternative considered:* keep the menu for spec continuity. Rejected: a one-item menu is worse
    for every visitor.
- **Active nav via react-router's `NavLink`** in `role-area-layout.tsx` (desktop nav and mobile
  sheet), styling `aria-current="page"`. `end` is set only on each role's root item (`/patient`,
  `/doctor`, `/admin`) so Home isn't always active while nested pages still highlight their section.
  - *Alternative considered:* compare `useLocation()` manually. Rejected: `NavLink` already sets
    `aria-current` and handles nested matching.
- **Profile lives in the account menu**, not the nav bar, for patients and doctors: it's a
  settings-type destination visited rarely, and the avatar menu already holds the account actions
  (sign out, sign out of all devices). This keeps the nav bar to the pages people use in a session.
  - *Alternative considered:* keep Profile in both places. Rejected: two entry points for one page
    add clutter without making it easier to find.
- **"Sign out of all devices" moves to a Security card on the Profile page**, not out of the app:
  the `auth` Sign-out requirement still needs a user-facing way to end every session (a lost or
  shared device). The card sits outside the profile's `QueryState`, so it's there even when the
  profile fails to load.
  - *Alternative considered:* drop it from the UI and keep only the API. Rejected: the capability
    would exist in the spec but be unreachable for users.
- **Search as you type, debounced 300ms**, writing `q` to the URL with `replace` so typing doesn't
  add a history entry per keystroke; an empty box clears the filter.
  - *Alternative considered:* keep the Search button alongside. Rejected in review: one fewer step,
    and the results area already shows loading and empty states for each query.
- **Availability range calendar with `react-day-picker` in a Radix popover.** A picked range of
  local days is sent as `[start of the first day, start of the day after the last)` in the
  browser's time zone (or `[now, …)` when it starts today), so the API contract
  (`availableFrom`/`availableTo`, at most 14 days) is unchanged. The calendar shows one month at a
  time with previous/next arrows, and disables days outside today to today + 13, matching the search
  window. The URL keeps `from`/`to` (`yyyy-MM-dd`; `to` defaults to `from`) so a view can be
  shared; a reversed, out-of-window, or malformed range is ignored.
  - *Interaction:* the first click picks the start, the second the end (either order), a third
    starts over; Apply commits, so a single day is just a start with no second click. The picker
    handles clicks itself instead of using the library's range reducer, which extends the existing
    range on every click and would make starting a new range awkward.
  - *Alternative considered:* `<input type="date">`. Rejected: its popup looks different in every
    browser, can't be styled to match the redesign, and has no range mode.
  - *Alternative considered:* a single-day picker, or two months side by side. Rejected in review:
    patients asked to pick a span ("any time this week"), and one month with arrows keeps the
    popover compact on every screen size.
- **Patient home cards** are real `<Link>`s whose accessible name is the title plus its description;
  the icons are `aria-hidden` lucide icons (`Search`, `HeartPulse`, `CalendarDays`, `FileText`,
  `UserRound`). The prompt keeps its `Complete your profile` text and its `Go to your profile` link
  to `/patient/profile`, which `home.test.tsx` asserts.
- **Admin approved-doctor note** renders only when `verificationStatus === 'APPROVED'`, linking to
  `/admin/users`. It explains the disabled Reject button instead of leaving admins to guess.

## Risks / Trade-offs

- [Taller buttons and inputs shift layouts, especially dense admin tables] → `sm` buttons stay at
  36px; check the admin screens at desktop and 375px width (the e2e responsive spec checks for no
  horizontal overflow).
- [Warm greys on the off-white background drop below AA] → `color-contrast.test.ts` gets the new
  values plus new pairs (text on `card`, `muted-foreground` on `muted`, `warm-foreground` on `warm`)
  in both themes; the axe checks in the e2e a11y spec cover rendered pages.
- [Font packages add bundle weight] → variable fonts, one file per family and Latin subset only.
  Removing Inter offsets part of it.
- [Visual regressions aren't covered by unit tests] → verify in a browser against the running stack
  (landing, sign-in, patient home, Find a doctor, admin doctor review, one doctor screen) in light
  and dark mode before marking the change done.

## Migration Plan

No data or API change. Rebuild the web image (`docker compose up --build -d web`); rollback is a
plain revert.

## Documentation

- `docs/modules/product-website.md`: the "self-contained assets" paragraph names
  `@fontsource-variable/inter`; update it to the two new font packages, and describe the header
  (logo + Sign in, no collapsed menu) and footer (registration links) as they now are.
