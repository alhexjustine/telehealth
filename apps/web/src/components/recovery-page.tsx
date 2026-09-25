import { useEffect } from 'react';
import { Link, useRouteError } from 'react-router';
import { Button, buttonVariants } from '@/components/ui/button';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import { roleHomePath } from '@/lib/auth/role-home';

/**
 * Rendered by every `errorElement` (the root route and each role layout —
 * see `router.tsx`) when a component throws during rendering. Per the
 * `ui-resilience` spec's "Unexpected error recovery": a plain-language
 * message, a Reload action, and a Home link, with the error logged to the
 * console only (no external reporting service).
 */
export function RecoveryPage() {
  const error = useRouteError();
  // `useCurrentUser` still works here: the error boundary renders inside
  // `QueryClientProvider` (wired in `App.tsx`, above the router), it just
  // replaces the failed subtree.
  const { data: user } = useCurrentUser();
  const homePath = user ? roleHomePath(user.role) : '/';

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="text-muted-foreground">
        We hit an unexpected error. Reloading the page usually fixes it; if it keeps happening,
        head back home and try again from there.
      </p>
      <div className="flex gap-3">
        <Button type="button" onClick={() => window.location.reload()}>
          Reload
        </Button>
        <Link to={homePath} className={buttonVariants({ variant: 'outline' })}>
          Go home
        </Link>
      </div>
    </main>
  );
}
