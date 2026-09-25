import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

/** A generated-initials avatar — no external avatar/file hosting. */
export function InitialsAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <Avatar className={cn(className)}>
      <AvatarFallback>{getInitials(name)}</AvatarFallback>
    </Avatar>
  );
}
