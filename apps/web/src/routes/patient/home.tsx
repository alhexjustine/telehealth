import { Link } from 'react-router';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useCurrentUser } from '@/lib/auth/use-current-user';

export function PatientHomePage() {
  const { data: user } = useCurrentUser();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Welcome{user ? `, ${user.displayName}` : ''}</h1>
      {user && user.profileComplete === false && (
        <Alert>
          <AlertTitle>Complete your profile</AlertTitle>
          <AlertDescription>
            Add your birthday, weight, height, and phone number so doctors and staff have what they
            need.{' '}
            <Link to="/patient/profile" className="text-primary underline-offset-4 hover:underline">
              Go to your profile
            </Link>
            .
          </AlertDescription>
        </Alert>
      )}
      <p className="text-muted-foreground">
        Doctor discovery, booking, and your consultations will appear here in a later update.
      </p>
    </div>
  );
}
