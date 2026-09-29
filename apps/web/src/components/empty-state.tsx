import { Link } from 'react-router';
import type { LucideIcon } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * The shared "nothing here yet" treatment for a list's `QueryState` `empty`
 * prop: an icon badge, a heading, and a description that orients the viewer
 * (what will show up here, and when) instead of just naming the absence.
 * `compact` drops the card framing and heading for a state nested inside a
 * container that already has its own border (a dashboard widget, a chat
 * panel) — a full card there would double up the framing.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact = false,
  className,
}: {
  icon: LucideIcon;
  title?: string;
  description: string;
  action?: { label: string; to: string };
  compact?: boolean;
  className?: string;
}) {
  if (compact) {
    return (
      <div className={cn('flex flex-col items-center gap-2 py-6 text-center', className)}>
        <Icon className="size-5 text-muted-foreground" strokeWidth={1.75} />
        <p className="text-sm text-muted-foreground">{description}</p>
        {action && (
          <Link to={action.to} className="text-sm text-primary underline-offset-4 hover:underline">
            {action.label}
          </Link>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex w-full flex-col items-center gap-4 rounded-2xl border border-border bg-card px-6 py-12 text-center sm:px-8 sm:py-16',
        className,
      )}
    >
      <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-secondary">
        <Icon className="size-6 text-primary" strokeWidth={1.75} />
      </div>
      <div className="flex max-w-prose flex-col gap-1">
        {title && <p className="font-display text-lg font-semibold text-foreground">{title}</p>}
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {action && (
        <Link to={action.to} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          {action.label}
        </Link>
      )}
    </div>
  );
}
