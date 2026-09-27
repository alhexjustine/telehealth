# Product Website

> The public landing page, navigation, trust/privacy/safety messaging, terms and privacy pages,
> and the self-contained-assets and accessibility guarantees are done (`add-product-website`).

## Module Overview

The product website is the public face of the app: `/`, `/terms`, `/privacy`, and a catch-all
not-found page, all wrapped in one `PublicLayout` (skip link, header, footer) that also wraps the
existing `/login` and `/register/{patient,doctor}` routes from `add-authentication`. It introduces
no new API routes or database tables — the landing page's specialization list reads the existing
public `GET /specializations` (`add-authentication`), and everything else is static, application-
authored content.

All public copy lives in typed modules under `apps/web/src/content/` (`landing.ts`, `terms.ts`,
`privacy.ts`, `disclaimer.ts`), rendered by the page components rather than inlined in JSX — the
wording is reviewable in one place, and `content/landing.test.ts` asserts the trust section still
names all six protections below every time the content changes.

### Header and navigation

`PublicLayout`'s header shows the Hey Doc logo and name (linking to `/`), and either a Sign in link
(visitor) or a single "Go to my dashboard" link to the signed-in user's role home (`roleHomePath`) —
the same `useCurrentUser()` query every role area uses. The registration calls to action live in
the landing hero, so the header doesn't repeat them; with one link it fits down to 360px, so there
is no collapsed menu (the "Mobile menu" scenario checks the links stay visible and focusable at
375px). The footer links to the landing page's own sections, the terms and privacy pages, sign-in,
Register as a patient, Join as a doctor, and `/status`, so registration stays one click away on
pages without a hero.

The logo (`BrandMark`) is a teal speech bubble holding a white heartbeat line, an inline SVG that
is also the favicon. It is decorative (`aria-hidden`); the "Hey Doc" wordmark beside it is the
link's accessible name.

### Landing page sections

`routes/public/landing.tsx` renders, in this fixed order: hero (headline, subcopy, both CTAs, and
an in-house inline-SVG illustration — no stock photography), capabilities, "How it works" (patient
steps), a doctors section, specializations (from `useQuery(['specializations'])`, with a fallback
message on error so the rest of the page still renders), trust/privacy/safety (including the
emergency notice), and an FAQ (`Accordion`, `radix-ui`).

### Trust, safety, and legal content

`PrototypeNotice` (the fictional-prototype disclaimer) appears on the landing page, sign-in, and
both registration pages — always the same wording from `content/disclaimer.ts`. `EmergencyNotice`
("not for emergencies") is visually distinct (a destructive-variant `Alert`) and appears on the
landing page. The trust section names exactly six implemented protections, each traceable to a
real control:

| Claim                             | Where it's actually implemented                                         |
| ---------------------------------- | ------------------------------------------------------------------------ |
| Hashed passwords                   | argon2id via `@node-rs/argon2` — see [Authentication & Authorization](/architecture/auth) |
| Server-side sessions                | Opaque token, `HttpOnly` cookie, SHA-256 hash checked every request      |
| Role-based access control          | `SessionAuthGuard`/`RolesGuard` as global `APP_GUARD`s, deny-by-default  |
| No admin access to clinical notes  | See [Clinical Access](/architecture/clinical-access) and [Admin](/modules/admin) |
| Audit log of admin actions          | Append-only `audit_logs`, DB trigger — see [Admin](/modules/admin#audit-log) |
| No third-party services             | No external SaaS/BaaS in the stack — see the repository `CLAUDE.md`      |

`/terms` and `/privacy` render `content/terms.ts`/`content/privacy.ts` (each a title, a
last-updated date, and an ordered list of sections/paragraphs). The privacy page's sections are,
in order: what data is stored, where it lives, who can access it by role, how sessions work, no
third-party sharing, and that all data is fictional. Both registration forms link to both pages
next to the submit button.

### Not found

A catch-all `*` route inside `PublicLayout` renders `NotFoundPage` for any unknown public path.
Each role area (`/patient`, `/doctor`, `/admin`) also has its own catch-all `*` route rendering the
same `NotFoundPage` inside that area's `RoleAreaLayout` outlet, so an unknown role-scoped path
keeps that role's own header/nav instead of falling through to the public one. The page always
links back to `/`, and additionally to the signed-in user's role home when there is one.

## Self-contained assets

Every script, stylesheet, font, icon, and image the public pages load is bundled and served by
this application — `@fontsource-variable/fraunces` (headings) and
`@fontsource-variable/public-sans` (body), self-hosted variable fonts imported via `index.css`,
instead of Google Fonts, `lucide-react` icons already bundled with the app, and
hand-written inline SVG for the hero illustration and favicon. Two independent guarantees back
this:

1. **Build-time check.** `apps/web/scripts/check-no-external-urls.mjs` (run as
   `pnpm --filter web run check:assets`, wired into CI after the web build) scans `dist/**/*.{html,js,css,svg,json}`
   for `https?://` and, in HTML/CSS/SVG only, protocol-relative `//host` references. It allow-lists
   only inert vendor strings confirmed by reading the built bundle — XML/SVG namespace identifiers,
   zod's `$schema` JSON Schema identifiers, and a handful of documentation/error-message links
   embedded in React, React Router, socket.io-client, and Tailwind's own output — none of which are
   ever fetched at runtime. Anything else fails the build.
2. **Runtime CSP.** `apps/web/nginx.conf`'s `location /` sets
   `Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; connect-src 'self' ws: wss:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`
   on SPA responses only — nginx does not merge a location's own `add_header` into a sibling
   location, so `/api/*` and `/socket.io/*` are unaffected and keep the API's own helmet-set CSP
   (see [Deployment](/architecture/deployment)).

## Accessibility

Public pages use semantic landmarks (`header`/`nav`/`main`/`footer`), one `h1` per page, a skip
link, visible focus indicators (Tailwind's default focus-visible rings), and respect
`prefers-reduced-motion` (a global rule in `index.css` collapses animation/transition durations).
`jest-axe` (imported under Vitest — it ships no Jest-runtime dependency, only the `axe-core` check
and a matcher) runs against the landing, terms, privacy, and not-found pages rendered inside
`PublicLayout`, asserting zero `serious`/`critical` violations. Contrast is checked at the design-
token level: `lib/color-contrast.ts`'s WCAG relative-luminance/contrast-ratio helpers are asserted
against every light-theme text/background token pair in `index.css`, each ≥ 4.5:1 (AA).

## L2 Container View

Reuses the [C4 L2 Container](/architecture/c4-container) diagram's `web` container — no new
container is introduced; the product website is routes and static assets served the same way the
Patient/Doctor/Admin UIs are, and reads the same public `GET /specializations` endpoint discovery
and registration already use.

## Data Model

None of its own — the specializations section reads the existing catalog (see
[Data Model](/architecture/data-model)); the rest of the module is static, application-authored
content with no database-backed state.
