import { Link, Outlet } from 'react-router';
import { buttonVariants } from '@/components/ui/button';
import { BrandMark } from '@/components/brand-mark';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import { roleHomePath } from '@/lib/auth/role-home';

const FOOTER_SECTION_LINKS = [
  { to: '/#capabilities', label: 'What you can do' },
  { to: '/#how-it-works', label: 'How it works' },
  { to: '/#for-doctors', label: 'For doctors' },
  { to: '/#specializations', label: 'Specializations' },
  { to: '/#trust', label: 'Trust & safety' },
  { to: '/#faq', label: 'FAQ' },
];

const FOOTER_ACCOUNT_LINKS = [
  { to: '/login', label: 'Sign in' },
  { to: '/register/patient', label: 'Register as a patient' },
  { to: '/register/doctor', label: 'Join as a doctor' },
  { to: '/status', label: 'System status' },
];

// The registration calls to action live in the landing hero and the footer, so the header only
// needs one link — which is also why it never collapses into a menu on small screens.
function HeaderAction() {
  const { data: user } = useCurrentUser();

  if (user) {
    return (
      <Link to={roleHomePath(user.role)} className={buttonVariants({ variant: 'default', size: 'sm' })}>
        Go to my dashboard
      </Link>
    );
  }

  return (
    <Link to="/login" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
      Sign in
    </Link>
  );
}

/**
 * Shared header, skip link, and footer for every public page (landing,
 * terms, privacy, sign-in, registration, not-found). See `design.md`'s
 * "Layout and routing" decision.
 */
export function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-6">
          <Link to="/" className="flex items-center gap-2.5 rounded-md text-foreground">
            <BrandMark className="size-9" />
            <span className="font-display text-xl font-semibold tracking-tight">Hey Doc</span>
          </Link>

          <nav aria-label="Primary">
            <HeaderAction />
          </nav>
        </div>
      </header>

      <main id="main-content" className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-border bg-muted/40">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 md:grid-cols-4 md:px-6">
          <div className="sm:col-span-2 md:col-span-1">
            <span className="flex items-center gap-2">
              <BrandMark className="size-7" />
              <span className="font-display text-lg font-semibold">Hey Doc</span>
            </span>
            <p className="mt-2 max-w-xs text-sm text-muted-foreground">
              A fictional-prototype telehealth product. Not for real medical use.
            </p>
          </div>
          <nav aria-label="Landing page sections">
            <h2 className="text-sm font-semibold text-foreground">Explore</h2>
            <ul className="mt-3 flex flex-col gap-2">
              {FOOTER_SECTION_LINKS.map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className="text-sm text-muted-foreground hover:text-foreground">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label="Legal">
            <h2 className="text-sm font-semibold text-foreground">Legal</h2>
            <ul className="mt-3 flex flex-col gap-2">
              <li>
                <Link to="/terms" className="text-sm text-muted-foreground hover:text-foreground">
                  Terms of use
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="text-sm text-muted-foreground hover:text-foreground">
                  Privacy policy
                </Link>
              </li>
            </ul>
          </nav>
          <nav aria-label="Account">
            <h2 className="text-sm font-semibold text-foreground">Account</h2>
            <ul className="mt-3 flex flex-col gap-2">
              {FOOTER_ACCOUNT_LINKS.map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className="text-sm text-muted-foreground hover:text-foreground">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <div className="border-t border-border px-4 py-4 text-center text-xs text-muted-foreground md:px-6">
          Fictional prototype — no real patients, doctors, or medical data. © 2026 Hey Doc.
        </div>
      </footer>
    </div>
  );
}
