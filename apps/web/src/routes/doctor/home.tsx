import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import { useDoctorProfile } from '@/lib/doctors/use-doctor-profile';

export function DoctorHomePage() {
  const { data: user } = useCurrentUser();
  const profile = useDoctorProfile();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Welcome{user ? `, ${user.displayName}` : ''}</h1>
      {user?.verificationStatus === 'PENDING' && (
        <Alert>
          <AlertTitle>Verification pending</AlertTitle>
          <AlertDescription>
            Your profile is awaiting administrator review and is not yet visible to patients.
          </AlertDescription>
        </Alert>
      )}
      {user?.verificationStatus === 'REJECTED' && (
        <Alert variant="destructive">
          <AlertTitle>Verification rejected</AlertTitle>
          <AlertDescription>
            Your profile was not approved and is not visible to patients.
            {profile.data?.reviewNote && (
              <>
                <br />
                Reviewer note: {profile.data.reviewNote}
              </>
            )}
          </AlertDescription>
        </Alert>
      )}
      <p className="text-muted-foreground">
        Your schedule, patient records, and consultations will appear here in a later update.
      </p>
    </div>
  );
}
