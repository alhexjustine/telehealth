import { useState } from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

const RATINGS = [1, 2, 3, 4, 5] as const;

/** An interactive 1-5 star picker, or a read-only display when `onChange` is omitted. */
export function StarRating({
  value,
  onChange,
  label,
  size = 'default',
}: {
  value: number;
  onChange?: (rating: number) => void;
  label?: string;
  size?: 'default' | 'sm';
}) {
  const [hovered, setHovered] = useState<number | undefined>(undefined);
  const readOnly = onChange === undefined;
  const displayed = hovered ?? value;
  const starSize = size === 'sm' ? 'size-4' : 'size-7';

  return (
    <div
      className="flex items-center gap-1"
      role={readOnly ? undefined : 'radiogroup'}
      aria-label={label ?? 'Rating'}
      onMouseLeave={() => setHovered(undefined)}
    >
      {RATINGS.map((star) => (
        <button
          key={star}
          type="button"
          disabled={readOnly}
          aria-label={readOnly ? undefined : `${star} star${star === 1 ? '' : 's'}`}
          aria-pressed={readOnly ? undefined : star === value}
          onClick={() => onChange?.(star)}
          onMouseEnter={() => !readOnly && setHovered(star)}
          className={cn('rounded-sm', readOnly ? 'cursor-default' : 'cursor-pointer')}
        >
          <Star
            className={cn(starSize, star <= displayed ? 'fill-primary text-primary' : 'fill-none text-muted-foreground')}
            strokeWidth={1.5}
          />
        </button>
      ))}
    </div>
  );
}
