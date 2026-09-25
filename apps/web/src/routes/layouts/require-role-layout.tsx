import { Navigate, Outlet, useLocation } from 'react-router';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import { roleHomePath } from '@/lib/auth/role-home';
import type { Role } from '@/lib/auth/types';

/**
 * Wraps a role's area (`/patient/*`, `/doctor/*`, `/admin/*`), or a
 * multi-role route like the consultation workspace (`role={['PATIENT',
 * 'DOCTOR']}`). A signed-out visitor is sent to sign-in and returned here
 * afterward; a signed-in user in the wrong role is sent to their own home
 * instead.
 */
export function RequireRoleLayout({ role }: { role: Role | Role[] }) {
  const { data: user, isPending } = useCurrentUser();
  const location = useLocation();

  if (isPending) {
    return null;
  }
  if (!user) {
    const returnTo = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?returnTo=${returnTo}`} replace />;
  }
  const allowedRoles = Array.isArray(role) ? role : [role];
  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={roleHomePath(user.role)} replace />;
  }
  return <Outlet />;
}
