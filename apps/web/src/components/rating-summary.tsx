import { Star } from 'lucide-react';

/** A compact "★ 4.7 · 12 reviews" summary, or "No reviews yet" when there are none. */
export function RatingSummary({
  averageRating,
  reviewCount,
  className,
}: {
  averageRating: number | null;
  reviewCount: number;
  className?: string;
}) {
  if (averageRating === null) {
    return <p className={className ?? 'text-sm text-muted-foreground'}>No reviews yet</p>;
  }
  return (
    <p className={className ?? 'flex items-center gap-1 text-sm text-muted-foreground'}>
      <Star className="size-4 fill-primary text-primary" strokeWidth={1.5} />
      <span className="font-medium text-foreground">{averageRating}</span>
      <span>
        · {reviewCount} review{reviewCount === 1 ? '' : 's'}
      </span>
    </p>
  );
}
