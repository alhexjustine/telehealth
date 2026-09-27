import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLogoutAllMutation } from '@/lib/auth/mutations';

/** Profile-page "Security" card: ends every session for this account, including the current one. */
export function SignOutEverywhereCard() {
  const navigate = useNavigate();
  const logoutAll = useLogoutAllMutation();

  async function handleSignOutEverywhere() {
    try {
      await logoutAll.mutateAsync();
      await navigate('/login', { replace: true });
    } catch {
      toast.error('Could not sign out. Please try again.');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Security</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Signed in on a device you no longer use or don&apos;t recognize? Sign out everywhere to end
          every session, including this one.
        </p>
        <Button
          type="button"
          variant="outline"
          className="shrink-0"
          disabled={logoutAll.isPending}
          onClick={() => void handleSignOutEverywhere()}
        >
          {logoutAll.isPending ? 'Signing out…' : 'Sign out of all devices'}
        </Button>
      </CardContent>
    </Card>
  );
}
