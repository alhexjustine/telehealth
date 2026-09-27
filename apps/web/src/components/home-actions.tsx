import type { LucideIcon } from 'lucide-react';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import { Card } from '@/components/ui/card';

export interface HomeAction {
  to: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

/** The "What would you like to do?" grid of icon cards on the role home pages. */
export function HomeActions({ actions }: { actions: HomeAction[] }) {
  return (
    <section aria-labelledby="home-actions-heading" className="flex flex-col gap-4">
      <h2
        id="home-actions-heading"
        className="font-sans text-sm font-bold tracking-wide text-muted-foreground uppercase"
      >
        What would you like to do?
      </h2>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {actions.map(({ to, label, description, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="group rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Card className="flex h-full flex-col gap-3 p-6 transition-colors group-hover:border-primary">
              <span className="flex size-12 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
                <Icon className="size-6" aria-hidden="true" />
              </span>
              <span className="mt-1 font-display text-lg font-semibold">{label}</span>
              <span className="flex-1 text-sm text-muted-foreground">{description}</span>
              <span className="flex items-center gap-1 text-sm font-semibold text-primary" aria-hidden="true">
                Open
                <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
