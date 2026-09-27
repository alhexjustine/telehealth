import { landingContent } from '@/content/landing';
import { cn } from '@/lib/utils';

/**
 * The landing hero's illustration: a doctor preview card over two tinted blocks, built from
 * theme tokens so it follows dark mode. Purely decorative (no stock photos, no external host) —
 * hidden from assistive tech since the hero heading and subcopy already carry the meaning.
 */
export function HeroIllustration({ className }: { className?: string }) {
  const card = landingContent.hero.previewCard;

  return (
    <div aria-hidden="true" className={cn('relative aspect-[6/5] w-full', className)}>
      <div className="absolute top-[6%] right-[4%] h-[66%] w-[62%] rounded-[2rem] bg-warm" />
      <div className="absolute bottom-[8%] left-[4%] h-[36%] w-[38%] rounded-[1.75rem] bg-secondary" />
      <div className="absolute top-1/2 left-1/2 flex w-[78%] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-card">
        <div className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground">
            {card.initials}
          </span>
          <div className="flex flex-col">
            <span className="font-display text-lg font-semibold">{card.name}</span>
            <span className="text-sm text-muted-foreground">{card.specialization}</span>
          </div>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">{card.bio}</p>
        <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
          <span className="text-xs text-muted-foreground">{card.meta}</span>
          <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
            {card.tag}
          </span>
        </div>
      </div>
    </div>
  );
}
