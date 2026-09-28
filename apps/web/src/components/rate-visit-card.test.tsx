import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RateVisitCard } from './rate-visit-card';
import { useOwnReview, useSubmitReview } from '@/lib/reviews/use-reviews';

vi.mock('@/lib/reviews/use-reviews', () => ({
  useOwnReview: vi.fn(),
  useSubmitReview: vi.fn(),
}));

describe('RateVisitCard', () => {
  it('Submits a new review', async () => {
    vi.mocked(useOwnReview).mockReturnValue({ data: null, isPending: false } as never);
    const mutateAsync = vi.fn().mockResolvedValue({ appointmentId: 'apt-1', rating: 5, comment: 'Great visit' });
    vi.mocked(useSubmitReview).mockReturnValue({ mutateAsync, isPending: false } as never);

    render(<RateVisitCard appointmentId="apt-1" />);

    expect(screen.getByText('Rate this visit')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '5 stars' }));
    await userEvent.type(screen.getByLabelText(/comment/i), 'Great visit');
    await userEvent.click(screen.getByRole('button', { name: /submit review/i }));

    expect(mutateAsync).toHaveBeenCalledWith({ rating: 5, comment: 'Great visit' });
  });

  it('Edits an existing review, prefilled', async () => {
    vi.mocked(useOwnReview).mockReturnValue({
      data: { appointmentId: 'apt-1', rating: 3, comment: 'It was okay', updatedAt: '2026-01-01T00:00:00.000Z' },
      isPending: false,
    } as never);
    const mutateAsync = vi.fn().mockResolvedValue({ appointmentId: 'apt-1', rating: 5, comment: 'Actually great' });
    vi.mocked(useSubmitReview).mockReturnValue({ mutateAsync, isPending: false } as never);

    render(<RateVisitCard appointmentId="apt-1" />);

    expect(screen.getByText('Your review')).toBeInTheDocument();
    expect(screen.getByLabelText(/comment/i)).toHaveValue('It was okay');
    expect(screen.getByRole('button', { name: '3 stars' })).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(screen.getByRole('button', { name: '5 stars' }));
    await userEvent.click(screen.getByRole('button', { name: /update review/i }));

    expect(mutateAsync).toHaveBeenCalledWith({ rating: 5, comment: 'It was okay' });
  });

  it('Rejects submission without a rating', async () => {
    vi.mocked(useOwnReview).mockReturnValue({ data: null, isPending: false } as never);
    const mutateAsync = vi.fn();
    vi.mocked(useSubmitReview).mockReturnValue({ mutateAsync, isPending: false } as never);

    render(<RateVisitCard appointmentId="apt-1" />);

    await userEvent.click(screen.getByRole('button', { name: /submit review/i }));

    expect(await screen.findByText(/choose a rating/i)).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
  });
});
