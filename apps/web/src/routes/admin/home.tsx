import { useCurrentUser } from '@/lib/auth/use-current-user';

export function AdminHomePage() {
  const { data: user } = useCurrentUser();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Welcome{user ? `, ${user.displayName}` : ''}</h1>
      <p className="text-muted-foreground">
        User management, doctor approval, appointment oversight, and the operational dashboard
        arrive in a later update.
      </p>
    </div>
  );
}
