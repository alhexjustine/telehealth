import { Navigate, Outlet, useLocation } from 'react-router';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import { roleHomePath } from '@/lib/auth/role-home';
import type { Role } from '@/lib/auth/types';

/**
 * Wraps a role's area (`/patient/*`, `/doctor/*`, `/admin/*`). A signed-out
 * visitor is sent to sign-in and returned here afterward; a signed-in user in
 * the wrong role is sent to their own home instead.
 */
export function RequireRoleLayout({ role }: { role: Role }) {
  const { data: user, isPending } = useCurrentUser();
  const location = useLocation();

  if (isPending) {
    return null;
  }
  if (!user) {
    const returnTo = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?returnTo=${returnTo}`} replace />;
  }
  if (user.role !== role) {
    return <Navigate to={roleHomePath(user.role)} replace />;
  }
  return <Outlet />;
}
