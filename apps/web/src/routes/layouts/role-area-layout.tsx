import { Link, Outlet, useNavigate } from 'react-router';
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
        <header className="flex items-center justify-between border-b border-border px-6 py-3">
          <nav className="flex items-center gap-6">
            <span className="font-semibold">Telehealth</span>
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
          {user && (
            <div className="flex items-center gap-3">
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
            </div>
          )}
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </RealtimeProvider>
  );
}
