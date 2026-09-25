import { Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { prototypeDisclaimer } from '@/content/disclaimer';
import { cn } from '@/lib/utils';

/**
 * The fictional-prototype disclaimer, shown on the landing page, sign-in,
 * and both registration pages (`Requirement: Trust, safety, and disclaimer
 * messaging`). Always the same wording, from `content/disclaimer.ts`.
 */
export function PrototypeNotice({ className }: { className?: string }) {
  return (
    <Alert className={cn('border-primary/30 bg-secondary', className)}>
      <Info className="text-primary" />
      <AlertTitle>{prototypeDisclaimer.title}</AlertTitle>
      <AlertDescription>{prototypeDisclaimer.body}</AlertDescription>
    </Alert>
  );
}
