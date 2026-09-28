import { Link } from 'react-router';
import { buttonVariants } from '@/components/ui/button';
import { isJoinable } from '@/lib/consultations/consultation-window';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import { cn } from '@/lib/utils';

interface JoinConsultationButtonProps {
  appointmentId: string;
  status: string;
  startsAt: string;
  endsAt: string;
  size?: 'default' | 'sm';
  className?: string;
}

/**
 * Shown on appointment cards, detail pages, and the doctor's today list
 * while joining is allowed — see the "Workspace in the web app" requirement.
 * Computed client-side from the same window as the API
 * (`consultation-window.ts`, pinned equal by its own test).
 */
export function JoinConsultationButton({
  appointmentId,
  status,
  startsAt,
  endsAt,
  size = 'sm',
  className,
}: JoinConsultationButtonProps) {
  const { data: user } = useCurrentUser();
  if (!isJoinable({ status, startsAt, endsAt, skipWindowCheck: user?.joinWindowDisabled })) {
    return null;
  }
  return (
    <Link
      to={`/consultations/${appointmentId}`}
      className={cn(buttonVariants({ variant: 'default', size }), className)}
    >
      Join consultation
    </Link>
  );
}
