import { cn } from '@/lib/utils';

/** The Hey Doc logo: a speech bubble ("Hey") holding a heartbeat line ("Doc"). Keep in sync with `public/favicon.svg`. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false" className={cn('size-8 shrink-0', className)}>
      <path
        d="M10 3h12a7 7 0 0 1 7 7v7a7 7 0 0 1-7 7h-8.2l-5.6 4.6a.8.8 0 0 1-1.3-.6V23.3A7 7 0 0 1 3 17v-7a7 7 0 0 1 7-7z"
        className="fill-primary"
      />
      <path
        d="M8 13.5h4l2-4.5 4 9 2-4.5h4"
        fill="none"
        className="stroke-primary-foreground"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
