import { Navigate, Outlet } from 'react-router';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import { roleHomePath } from '@/lib/auth/role-home';

/**
 * Wraps sign-in and registration routes. A signed-in user visiting one of
 * these pages is sent to their own role's home instead of seeing the form.
 */
export function PublicOnlyLayout() {
  const { data: user, isPending } = useCurrentUser();

  if (isPending) {
    return null;
  }
  if (user) {
    return <Navigate to={roleHomePath(user.role)} replace />;
  }
  return <Outlet />;
}
