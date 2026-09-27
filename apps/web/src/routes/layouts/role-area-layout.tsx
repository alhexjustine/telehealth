import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router';
import { Menu } from 'lucide-react';
import { toast } from 'sonner';
import { BrandMark } from '@/components/brand-mark';
import { InitialsAvatar } from '@/components/initials-avatar';
import { NotificationBell } from '@/components/notification-bell';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import { useLogoutMutation } from '@/lib/auth/mutations';
import { RealtimeProvider } from '@/lib/realtime/realtime-provider';
import { cn } from '@/lib/utils';

export interface RoleNavItem {
  to: string;
  label: string;
}

// A role's root item (`/patient`) matches only exactly, so Home isn't active on every page; deeper
// items (`/patient/doctors`) stay active on their nested pages (`/patient/doctors/:id`).
function isRoleRoot(to: string): boolean {
  return to.split('/').filter(Boolean).length === 1;
}

/**
 * Shared header (role navigation, initials avatar, sign-out menu) for every
 * role area. Rendered inside `RequireRoleLayout`, so `useCurrentUser()` is
 * already guaranteed to have a signed-in user of the right role by then.
 */
export function RoleAreaLayout({ navItems, profilePath }: { navItems: RoleNavItem[]; profilePath?: string }) {
  const { data: user } = useCurrentUser();
  const navigate = useNavigate();
  const logout = useLogoutMutation();
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleLogout() {
    try {
      await logout.mutateAsync();
      await navigate('/login', { replace: true });
    } catch {
      toast.error('Could not sign out. Please try again.');
    }
  }

  return (
    <RealtimeProvider>
      <div className="flex min-h-screen flex-col">
        <header className="flex h-16 items-center justify-between gap-3 border-b border-border bg-card px-4 sm:px-6 print:hidden">
          <div className="flex h-full min-w-0 items-center gap-8">
            <span className="flex shrink-0 items-center gap-2">
              <BrandMark className="size-8" />
              <span className="font-display text-lg font-semibold tracking-tight">Hey Doc</span>
            </span>
            <nav aria-label="Main" className="hidden h-full items-stretch gap-6 md:flex">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={isRoleRoot(item.to)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center border-b-2 pt-0.5 text-sm transition-colors',
                      isActive
                        ? 'border-primary font-semibold text-foreground'
                        : 'border-transparent text-muted-foreground hover:text-foreground',
                    )
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {user && (
              <>
                <NotificationBell role={user.role} />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2 rounded-full px-1.5">
                      <InitialsAvatar name={user.displayName} className="size-6" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>{user.displayName}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {profilePath && (
                      <>
                        <DropdownMenuItem asChild>
                          <Link to={profilePath}>Profile</Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    <DropdownMenuItem onSelect={() => void handleLogout()}>Sign out</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
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
                <nav className="flex flex-col items-start gap-4">
                  {navItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={isRoleRoot(item.to)}
                      onClick={() => setMenuOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          'text-sm font-medium hover:text-primary',
                          isActive ? 'font-semibold text-primary' : 'text-foreground',
                        )
                      }
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </RealtimeProvider>
  );
}
