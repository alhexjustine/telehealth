import type { MouseEvent } from 'react';
import { Heart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFavoriteDoctor, useUnfavoriteDoctor } from '@/lib/favorites/use-favorites';

/**
 * When nested inside a card's own `<Link>` (as on the search results page),
 * pass `stopPropagation` (the default) so toggling never triggers the card's
 * navigation. On a page where the button isn't nested in a link (the doctor
 * profile page), pass `stopPropagation={false}`.
 */
export function FavoriteToggleButton({
  doctorId,
  isFavorited,
  stopPropagation = true,
  className,
}: {
  doctorId: string;
  isFavorited: boolean;
  stopPropagation?: boolean;
  className?: string;
}) {
  const favorite = useFavoriteDoctor();
  const unfavorite = useUnfavoriteDoctor();
  const pending = favorite.isPending || unfavorite.isPending;

  function toggle(event: MouseEvent) {
    if (stopPropagation) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (isFavorited) unfavorite.mutate(doctorId);
    else favorite.mutate(doctorId);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={isFavorited}
      aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
      className={cn(
        'shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-50',
        isFavorited && 'text-primary hover:text-primary',
        className,
      )}
    >
      <Heart className={cn('size-4', isFavorited && 'fill-current')} />
    </button>
  );
}
