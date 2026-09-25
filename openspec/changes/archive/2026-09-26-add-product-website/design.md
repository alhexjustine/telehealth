# Design

## Context

`apps/web` is a Vite + React SPA with React Router, TanStack Query, Tailwind v4, and shadcn/ui.
`/` is currently a placeholder (with Sign in / Create account links added by `add-authentication`),
and `/status` exists. Auth provides `useCurrentUser()`, the `PublicOnly` layout for sign-in and
registration, and role-home resolution. `GET /api/specializations` is public.

The requirements are in `specs/product-website`. If earlier changes' names differ once
implemented, adapt.

## Goals / Non-Goals

**Goals:**
- A polished, credible landing page whose claims match what the app really does.
- Public copy kept in one typed content module, so wording is reviewable and editable without
  hunting through components.
- A mechanical guarantee that no external asset sneaks in.

**Non-Goals:**
- Server-side rendering and prerendering for SEO. Static meta tags in `index.html` are enough for
  a prototype; see the decision below.
- Dark mode, internationalization, a blog, pricing, and contact forms. A contact form would need a
  form service or new API scope.
- Analytics of any kind.

## Decisions

### Content as typed modules
`src/content/landing.ts`, `terms.ts`, `privacy.ts`, and `disclaimer.ts` export structured
objects: headings, paragraphs, FAQ items, steps, and a last-updated date. Components render
them. The trust claims in `landing.ts` are written against the implemented protections. The
content module carries a short comment that each claim must stay true, and a unit test asserts
that the trust section lists the six protections named in the spec.
*Rejected:* markdown files with a loader. Typed objects give structure (FAQ lists, steps)
without an MDX toolchain.

### Layout and routing
A `PublicLayout` (header, main, footer, skip link) wraps `/`, `/terms`, `/privacy`, the
not-found page, and the existing `/login` and `/register/*` routes. It sits inside or alongside
`PublicOnly`: `PublicOnly` still redirects signed-in users away from sign-in and registration.
The landing page is not `PublicOnly`; signed-in users can view it, and the header adapts.

A catch-all `*` route renders `NotFoundPage`, in `PublicLayout`, for unknown routes. Role-area
unknown routes (for example `/patient/x`) also fall through to it, inside the role layout's
outlet.

`/status` stays, linked from the footer as "System status".

### Visual design
- Uses shadcn theme tokens. A calm clinical palette is set in `index.css` (a teal primary and a
  neutral background), with every text/background pair checked against AA.
- Hero: headline, subcopy, two CTAs, and an inline SVG illustration built in-house (an abstract
  consultation motif: no stock photos, no external host).
- Capability and step cards use `lucide-react` icons, which are already bundled.
- The specializations section shows chips from `useQuery(['specializations'])`, with a fallback
  line on error.
- FAQ uses shadcn's accordion (add the component).
- The disclaimer is an `Alert`-style banner component (`PrototypeNotice`), reused on the landing
  page, sign-in, and registration pages. The emergency notice is a separate, visually distinct
  callout.
- Motion is limited to subtle hover and transition effects, disabled under
  `prefers-reduced-motion`.

### Fonts
`@fontsource-variable/inter`, imported in `main.tsx`, is bundled by Vite and served from the app
origin. Tailwind's `--font-sans` is set to `"Inter Variable", system-ui, sans-serif`.
*Rejected:* Google Fonts, which is an external host and violates the spec.

### Header responsiveness
Below `md` (768px), a menu button toggles a panel. It uses shadcn `Sheet` or a
disclosure with focus management: the focus moves into the panel, Escape closes it, and the
focus returns to the button. The links in the panel are the same as on desktop.

### No-external-URL check
`apps/web/scripts/check-no-external-urls.mjs` scans `dist/**/*.{html,js,css,svg,json}` for
`https?://` and protocol-relative `//host` URLs. It allow-lists only XML namespace identifiers
(`http://www.w3.org/…`) and fails with the offending file and URL. It runs as
`pnpm --filter web run check:assets` after the build, in CI.

The runtime scenario, "No third-party requests at runtime", is covered by the Playwright suite
in `harden-core-journey`. This change verifies it manually with the browser devtools network
panel, or a headless browser script if available.
*Rejected:* a Content-Security-Policy on the SPA alone. It's worth adding in nginx as defense in
depth (`default-src 'self'`, with the same exceptions the API docs need). Add it, but it doesn't
replace the build check, because CSP only reports at runtime.

### nginx CSP
Add `Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; connect-src 'self' ws: wss:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`
for SPA responses, not for the proxied `/api` responses. Verify through compose that the app,
including sockets, still works.

### Meta tags
`index.html` gets a title, a description, `theme-color`, and a local favicon (SVG), with no
external Open Graph images. Each page sets `document.title` through a tiny `useDocumentTitle`
hook.
*Rejected:* prerendering the landing page with a Vite SSG plugin. It adds a build mode and
hydration concerns for a prototype that isn't indexed; this is recorded as future work.

### Accessibility testing
`vitest-axe` (or `jest-axe` with Vitest) runs over the rendered landing, terms, privacy, and
not-found pages, failing on serious or critical violations. Keyboard tests for the mobile menu
use Testing Library `user-event`. Contrast is checked at design time against the token values,
with a small test asserting the computed ratio of the primary text/background token pairs,
using a tiny luminance helper, at least 4.5:1.

## Risks / Trade-offs

- [Trust claims drift from reality as the code changes] → Claims live in one content file,
  covered by a unit test and the docs.
- [jsdom can't measure layout, so horizontal scroll at 360px isn't testable in Vitest] → Checked
  manually in this change and automated in Playwright in `harden-core-journey`.
- [CSP could break the sockets or the docs route] → CSP applies to SPA responses only, and is
  verified in compose.

## Migration Plan

Web-only. The placeholder root page is replaced.

## Documentation impact

- `docs/modules/product-website.md`: the full module overview (sections, CTAs, trust claims and
  how each maps to an implemented control), the L2 view (browser → nginx → static assets, plus
  the public specializations API), no data model of its own (it reads the specialization catalog),
  the self-contained asset guarantee (build check plus CSP), and accessibility.
- `docs/architecture/deployment.md`: the nginx CSP note.
- `docs/index.md`: the product website feature moves to done.
