import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { useDoctorProfile, useUpdateDoctorProfile } from '@/lib/doctors/use-doctor-profile';

/** The doctor home page's "In" / "Out" control: pauses or resumes new patient bookings. */
export function AcceptingBookingsToggle() {
  const profile = useDoctorProfile();
  const update = useUpdateDoctorProfile();

  if (!profile.data) return null;

  const acceptingBookings = profile.data.acceptingBookings;

  async function handleChange(next: boolean) {
    try {
      await update.mutateAsync({ acceptingBookings: next });
    } catch {
      toast.error('Could not update your availability. Please try again.');
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-2.5">
      <Switch
        id="accepting-bookings"
        checked={acceptingBookings}
        disabled={update.isPending}
        onCheckedChange={(checked) => void handleChange(checked)}
        aria-label="Accepting new bookings"
      />
      <label htmlFor="accepting-bookings" className="flex flex-col leading-tight">
        <span className="text-sm font-semibold">{acceptingBookings ? 'In' : 'Out'}</span>
        <span className="text-xs text-muted-foreground">
          {acceptingBookings ? 'Accepting new bookings' : 'Not accepting new bookings'}
        </span>
      </label>
    </div>
  );
}
