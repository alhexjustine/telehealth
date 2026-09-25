import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { emergencyNotice } from '@/content/disclaimer';
import { cn } from '@/lib/utils';

/**
 * A visually distinct "not for emergencies" callout — separate from
 * `PrototypeNotice` so it reads as a safety warning, not general disclaimer
 * text (`Requirement: Trust, safety, and disclaimer messaging`).
 */
export function EmergencyNotice({ className }: { className?: string }) {
  return (
    <Alert variant="destructive" className={cn('border-destructive/40', className)}>
      <AlertTriangle />
      <AlertTitle>{emergencyNotice.title}</AlertTitle>
      <AlertDescription>{emergencyNotice.body}</AlertDescription>
    </Alert>
  );
}
