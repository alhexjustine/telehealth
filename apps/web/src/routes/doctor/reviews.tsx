import { useState } from 'react';
import { Star } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { StarRating } from '@/components/star-rating';
import { RatingSummary } from '@/components/rating-summary';
import { EmptyState } from '@/components/empty-state';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import { useDoctorReviews } from '@/lib/reviews/use-reviews';
import { QueryState } from '@/components/query-state';
import { Pagination } from '@/components/pagination';

const PAGE_SIZE = 5;

/** The doctor's own view of their patient reviews — same anonymous, visible-only list a patient sees on the doctor's public profile. */
export function DoctorReviewsPage() {
  const currentUser = useCurrentUser();
  const [page, setPage] = useState(1);
  const reviews = useDoctorReviews(currentUser.data?.id, page, PAGE_SIZE);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <h1 className="text-2xl font-semibold">Reviews</h1>
      <p className="text-sm text-muted-foreground">
        Patient ratings and comments from your completed consultations. Reviewers stay anonymous.
      </p>

      <QueryState
        query={reviews}
        label="reviews"
        isEmpty={(data) => data.items.length === 0}
        empty={
          <EmptyState
            icon={Star}
            title="No reviews yet"
            description="Ratings and comments show up here once a patient reviews a completed consultation with you."
          />
        }
      >
        {(data) => (
          <>
            <RatingSummary averageRating={data.averageRating} reviewCount={data.reviewCount} />
            <div className="flex flex-col gap-3">
              {data.items.map((review) => (
                <Card key={review.id}>
                  <CardContent className="flex flex-col gap-2 pt-6">
                    <div className="flex items-center gap-2">
                      <StarRating value={review.rating} size="sm" />
                      <span className="text-xs text-muted-foreground">
                        {new Date(review.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {review.comment && <p className="text-sm">{review.comment}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />
          </>
        )}
      </QueryState>
    </div>
  );
}
