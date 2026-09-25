import { useState } from 'react';
import { Link, Outlet } from 'react-router';
import { Menu } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import { roleHomePath } from '@/lib/auth/role-home';
import { cn } from '@/lib/utils';

const FOOTER_SECTION_LINKS = [
  { to: '/#capabilities', label: 'What you can do' },
  { to: '/#how-it-works', label: 'How it works' },
  { to: '/#for-doctors', label: 'For doctors' },
  { to: '/#specializations', label: 'Specializations' },
  { to: '/#trust', label: 'Trust & safety' },
  { to: '/#faq', label: 'FAQ' },
];

function PublicNavLinks({ onNavigate, className }: { onNavigate?: () => void; className?: string }) {
  const { data: user } = useCurrentUser();

  if (user) {
    return (
      <div className={className}>
        <Link
          to={roleHomePath(user.role)}
          onClick={onNavigate}
          className={buttonVariants({ variant: 'default' })}
        >
          Go to my dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className={className}>
      <Link
        to="/login"
        onClick={onNavigate}
        className="text-sm font-medium text-foreground hover:text-primary"
      >
        Sign in
      </Link>
      <Link
        to="/register/patient"
        onClick={onNavigate}
        className={buttonVariants({ variant: 'outline', size: 'sm' })}
      >
        Register as a patient
      </Link>
      <Link
        to="/register/doctor"
        onClick={onNavigate}
        className={buttonVariants({ variant: 'default', size: 'sm' })}
      >
        Join as a doctor
      </Link>
    </div>
  );
}

/**
 * Shared header, skip link, and footer for every public page (landing,
 * terms, privacy, sign-in, registration, not-found). See `design.md`'s
 * "Layout and routing" decision.
 */
export function PublicLayout() {
  const [menuOpen, setMenuOpen] = useState(false);

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
          <Link to="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <span
              className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"
              aria-hidden="true"
            >
              +
            </span>
            Telehealth
          </Link>

          <PublicNavLinks className="hidden items-center gap-5 md:flex" />

          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="size-9 p-0 md:hidden" aria-label="Open menu">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right">
              <SheetHeader>
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <PublicNavLinks
                onNavigate={() => setMenuOpen(false)}
                className="flex flex-col items-start gap-4"
              />
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <main id="main-content" className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-border bg-muted/40">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 md:grid-cols-4 md:px-6">
          <div className="sm:col-span-2 md:col-span-1">
            <span className="text-base font-semibold">Telehealth</span>
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
              <li>
                <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground">
                  Sign in
                </Link>
              </li>
              <li>
                <Link to="/status" className="text-sm text-muted-foreground hover:text-foreground">
                  System status
                </Link>
              </li>
            </ul>
          </nav>
        </div>
        <div className={cn('border-t border-border px-4 py-4 text-center text-xs text-muted-foreground md:px-6')}>
          Fictional prototype — no real patients, doctors, or medical data. © 2026 Telehealth.
        </div>
      </footer>
    </div>
  );
}
