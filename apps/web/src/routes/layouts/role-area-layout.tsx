import { useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router';
import { Menu } from 'lucide-react';
import { toast } from 'sonner';
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
import { useLogoutAllMutation, useLogoutMutation } from '@/lib/auth/mutations';
import { RealtimeProvider } from '@/lib/realtime/realtime-provider';

export interface RoleNavItem {
  to: string;
  label: string;
}

/**
 * Shared header (role navigation, initials avatar, sign-out menu) for every
 * role area. Rendered inside `RequireRoleLayout`, so `useCurrentUser()` is
 * already guaranteed to have a signed-in user of the right role by then.
 */
export function RoleAreaLayout({ navItems }: { navItems: RoleNavItem[] }) {
  const { data: user } = useCurrentUser();
  const navigate = useNavigate();
  const logout = useLogoutMutation();
  const logoutAll = useLogoutAllMutation();
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleLogout() {
    try {
      await logout.mutateAsync();
      await navigate('/login', { replace: true });
    } catch {
      toast.error('Could not sign out. Please try again.');
    }
  }

  async function handleLogoutAll() {
    try {
      await logoutAll.mutateAsync();
      await navigate('/login', { replace: true });
    } catch {
      toast.error('Could not sign out. Please try again.');
    }
  }

  return (
    <RealtimeProvider>
      <div className="flex min-h-screen flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-6 print:hidden">
          <div className="flex min-w-0 items-center gap-6">
            <span className="shrink-0 font-semibold">Telehealth</span>
            <nav className="hidden items-center gap-6 md:flex">
              {navItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  {item.label}
                </Link>
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
                    <DropdownMenuItem onSelect={() => void handleLogout()}>Sign out</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => void handleLogoutAll()}>
                      Sign out of all devices
                    </DropdownMenuItem>
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
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setMenuOpen(false)}
                      className="text-sm font-medium text-foreground hover:text-primary"
                    >
                      {item.label}
                    </Link>
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
