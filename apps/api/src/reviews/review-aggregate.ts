/** A doctor's rating computed from visible (non-hidden) reviews only. */
export interface ReviewAggregate {
  averageRating: number | null;
  reviewCount: number;
}

export const NO_REVIEWS: ReviewAggregate = { averageRating: null, reviewCount: 0 };

/** Rounds to 1 decimal, e.g. for an average of 4 out of 3 ratings (4.333...) -> 4.3. */
export function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}
