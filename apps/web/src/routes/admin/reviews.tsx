import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { Star } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { StarRating } from '@/components/star-rating';
import {
  useAdminReviews,
  useHideReview,
  useUnhideReview,
  type AdminReviewListQuery,
} from '@/lib/admin/use-admin-reviews';
import { QueryState } from '@/components/query-state';
import { EmptyState } from '@/components/empty-state';
import { Pagination } from '@/components/pagination';

type AdminReviewItem = NonNullable<ReturnType<typeof useAdminReviews>['data']>['items'][number];
type ModerationAction = 'hide' | 'unhide';

const PAGE_SIZE = 5;
const REASON_MIN_LENGTH = 5;
const selectClassName =
  'h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

export function AdminReviewsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [doctorNameInput, setDoctorNameInput] = useState(searchParams.get('doctorName') ?? '');
  const [doctorIdInput, setDoctorIdInput] = useState(searchParams.get('doctorId') ?? '');
  const [dialogTarget, setDialogTarget] = useState<{ review: AdminReviewItem; action: ModerationAction } | undefined>(
    undefined,
  );

  const hiddenParam = searchParams.get('hidden');
  const query: AdminReviewListQuery = {
    doctorName: searchParams.get('doctorName') || undefined,
    doctorId: searchParams.get('doctorId') || undefined,
    hidden: hiddenParam === 'true' ? true : hiddenParam === 'false' ? false : undefined,
    page: Number(searchParams.get('page') ?? '1') || 1,
    pageSize: PAGE_SIZE,
  };
  const reviews = useAdminReviews(query);
  const hasFilters = Boolean(query.doctorName || query.doctorId || hiddenParam);

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page');
    setSearchParams(next);
  }

  function goToPage(page: number) {
    const next = new URLSearchParams(searchParams);
    if (page > 1) next.set('page', String(page));
    else next.delete('page');
    setSearchParams(next);
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Reviews</h1>
      <p className="text-sm text-muted-foreground">
        Patient ratings and comments left on doctors after a completed consultation.
      </p>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 pt-6">
          <div className="flex flex-col gap-1">
            <Label htmlFor="admin-reviews-doctor-name">Doctor name</Label>
            <div className="flex gap-2">
              <Input
                id="admin-reviews-doctor-name"
                placeholder="Doctor name"
                value={doctorNameInput}
                onChange={(e) => setDoctorNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') updateParam('doctorName', doctorNameInput);
                }}
                className="w-72"
              />
              <Button type="button" variant="outline" onClick={() => updateParam('doctorName', doctorNameInput)}>
                Filter
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="admin-reviews-doctor-id">Doctor ID</Label>
            <div className="flex gap-2">
              <Input
                id="admin-reviews-doctor-id"
                placeholder="Doctor ID"
                value={doctorIdInput}
                onChange={(e) => setDoctorIdInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') updateParam('doctorId', doctorIdInput);
                }}
                className="w-72"
              />
              <Button type="button" variant="outline" onClick={() => updateParam('doctorId', doctorIdInput)}>
                Filter
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="admin-reviews-hidden">Status</Label>
            <select
              id="admin-reviews-hidden"
              className={selectClassName}
              value={hiddenParam ?? ''}
              onChange={(e) => updateParam('hidden', e.target.value)}
            >
              <option value="">All</option>
              <option value="false">Visible</option>
              <option value="true">Hidden</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <QueryState
        query={reviews}
        label="reviews"
        isEmpty={(data) => data.items.length === 0}
        empty={
          <EmptyState
            icon={Star}
            title="No reviews found"
            description={
              hasFilters
                ? 'No reviews match your filters. Try clearing them or changing the status.'
                : 'Patient ratings and comments will show up here once a completed consultation is reviewed.'
            }
          />
        }
      >
        {(data) => (
          <div className="flex flex-col gap-3">
            {data.items.map((review) => (
              <Card key={review.id}>
                <CardContent className="flex flex-col gap-2 pt-6 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <StarRating value={review.rating} size="sm" />
                      {review.hidden && <Badge variant="destructive">Hidden</Badge>}
                    </div>
                    <p className="text-sm">
                      For <span className="font-medium">{review.doctorDisplayName}</span> · anonymous patient
                    </p>
                    {review.comment && <p className="text-sm">{review.comment}</p>}
                    {review.hidden && review.hiddenReason && (
                      <p className="text-sm text-muted-foreground">Hidden reason: {review.hiddenReason}</p>
                    )}
                    <p className="text-xs text-muted-foreground">{new Date(review.createdAt).toLocaleString()}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setDialogTarget({ review, action: review.hidden ? 'unhide' : 'hide' })}
                  >
                    {review.hidden ? 'Unhide' : 'Hide'}
                  </Button>
                </CardContent>
              </Card>
            ))}
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={goToPage} />
          </div>
        )}
      </QueryState>

      <ModerateReviewDialog target={dialogTarget} onClose={() => setDialogTarget(undefined)} />
    </div>
  );
}

function ModerateReviewDialog({
  target,
  onClose,
}: {
  target: { review: AdminReviewItem; action: ModerationAction } | undefined;
  onClose: () => void;
}) {
  const hideReview = useHideReview();
  const unhideReview = useUnhideReview();
  const [reason, setReason] = useState('');
  const reasonValid = reason.trim().length >= REASON_MIN_LENGTH;
  const pending = hideReview.isPending || unhideReview.isPending;

  async function confirm() {
    if (!target || !reasonValid) return;
    try {
      if (target.action === 'hide') {
        await hideReview.mutateAsync({ id: target.review.id, body: { reason: reason.trim() } });
        toast.success('Review hidden');
      } else {
        await unhideReview.mutateAsync({ id: target.review.id, body: { reason: reason.trim() } });
        toast.success('Review unhidden');
      }
      setReason('');
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update this review');
    }
  }

  const verb = target?.action === 'hide' ? 'Hide' : 'Unhide';

  return (
    <Dialog
      open={target !== undefined}
      onOpenChange={(open) => {
        if (!open) {
          setReason('');
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {verb} this review of {target?.review.doctorDisplayName}?
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-1">
          <Label htmlFor="review-moderation-reason">Reason</Label>
          <Textarea id="review-moderation-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          {!reasonValid && reason.length > 0 && (
            <p className="text-sm text-destructive">At least {REASON_MIN_LENGTH} characters are required.</p>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={!reasonValid || pending} onClick={() => void confirm()}>
            {pending ? 'Saving…' : `${verb} review`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
