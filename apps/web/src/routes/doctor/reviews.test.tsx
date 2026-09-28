import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DoctorReviewsPage } from './reviews';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import { useDoctorReviews } from '@/lib/reviews/use-reviews';

vi.mock('@/lib/auth/use-current-user', () => ({ useCurrentUser: vi.fn() }));
vi.mock('@/lib/reviews/use-reviews', () => ({ useDoctorReviews: vi.fn() }));

describe('DoctorReviewsPage', () => {
  it('Shows the aggregate rating and each anonymous review', () => {
    vi.mocked(useCurrentUser).mockReturnValue({ data: { id: 'doc-1' } } as never);
    vi.mocked(useDoctorReviews).mockReturnValue({
      data: {
        items: [
          { id: 'rev-1', rating: 5, comment: 'Great bedside manner', createdAt: '2026-01-01T00:00:00.000Z' },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
        averageRating: 5,
        reviewCount: 1,
      },
      status: 'success',
      error: null,
      isPending: false,
      refetch: vi.fn(),
    } as never);

    render(<DoctorReviewsPage />);

    expect(screen.getByText(/1 review/i)).toBeInTheDocument();
    expect(screen.getByText(/great bedside manner/i)).toBeInTheDocument();
    expect(screen.queryByText(/ada|lovelace|patient name/i)).not.toBeInTheDocument();
  });

  it('No reviews yet', () => {
    vi.mocked(useCurrentUser).mockReturnValue({ data: { id: 'doc-1' } } as never);
    vi.mocked(useDoctorReviews).mockReturnValue({
      data: { items: [], total: 0, page: 1, pageSize: 20, averageRating: null, reviewCount: 0 },
      status: 'success',
      error: null,
      isPending: false,
      refetch: vi.fn(),
    } as never);

    render(<DoctorReviewsPage />);

    expect(screen.getByText(/no reviews yet/i)).toBeInTheDocument();
  });
});
