import { Link } from 'react-router';
import { CompassIcon } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import { roleHomePath } from '@/lib/auth/role-home';
import { useDocumentTitle } from '@/lib/use-document-title';

/** Shown for any unknown route (`Requirement: Not-found page`). */
export function NotFoundPage() {
  useDocumentTitle('Page not found');
  const { data: user } = useCurrentUser();

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
      <span
        className="flex size-14 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
        aria-hidden="true"
      >
        <CompassIcon className="size-7" />
      </span>
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-muted-foreground">
        We couldn&apos;t find the page you were looking for. It may have moved, or the link may be
        out of date.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link to="/" className={buttonVariants({ variant: 'default' })}>
          Back to the landing page
        </Link>
        {user && (
          <Link to={roleHomePath(user.role)} className={buttonVariants({ variant: 'outline' })}>
            Go to my dashboard
          </Link>
        )}
      </div>
    </div>
  );
}
