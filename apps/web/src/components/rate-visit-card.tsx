import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { StarRating } from '@/components/star-rating';
import { useOwnReview, useSubmitReview } from '@/lib/reviews/use-reviews';

/** Matches `MAX_REVIEW_COMMENT_LENGTH` in `apps/api/src/reviews/dto/submit-review.dto.ts`. */
const MAX_COMMENT_LENGTH = 1000;

/** A "Rate this visit" prompt/form for a completed appointment, prefilled if the caller already left a review. */
export function RateVisitCard({ appointmentId }: { appointmentId: string }) {
  const ownReview = useOwnReview(appointmentId);
  const submitReview = useSubmitReview(appointmentId);

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [ratingTouched, setRatingTouched] = useState(false);

  // Prefill once the existing review loads — a ref-less alternative to an
  // effect: compare to a remembered snapshot of what we last synced from.
  const [lastSynced, setLastSynced] = useState<string | undefined>(undefined);
  if (ownReview.data !== undefined && ownReview.data?.appointmentId !== lastSynced) {
    setLastSynced(ownReview.data?.appointmentId);
    setRating(ownReview.data?.rating ?? 0);
    setComment(ownReview.data?.comment ?? '');
  }

  const commentTooLong = comment.length > MAX_COMMENT_LENGTH;
  const showRatingError = ratingTouched && rating === 0;

  async function submit() {
    setRatingTouched(true);
    if (rating === 0 || commentTooLong) return;
    try {
      await submitReview.mutateAsync({ rating, comment: comment.trim() || undefined });
      toast.success('Thanks for your feedback');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save your review');
    }
  }

  if (ownReview.isPending) return null;

  const hasExistingReview = Boolean(ownReview.data);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{hasExistingReview ? 'Your review' : 'Rate this visit'}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <StarRating label="Rating" value={rating} onChange={setRating} />
          {showRatingError && <p className="text-sm text-destructive">Choose a rating from 1 to 5 stars.</p>}
        </div>
        <div className="flex flex-col gap-1">
          <Textarea
            aria-label="Comment (optional)"
            placeholder="Share more about your visit (optional)"
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <div className="flex justify-end">
            <p className={commentTooLong ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}>
              {comment.length}/{MAX_COMMENT_LENGTH}
            </p>
          </div>
        </div>
        <Button type="button" disabled={submitReview.isPending} onClick={() => void submit()} className="self-start">
          {submitReview.isPending ? 'Saving…' : hasExistingReview ? 'Update review' : 'Submit review'}
        </Button>
      </CardContent>
    </Card>
  );
}
