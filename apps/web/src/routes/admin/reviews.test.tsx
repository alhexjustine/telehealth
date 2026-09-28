import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { AdminReviewsPage } from './reviews';
import { useAdminReviews, useHideReview, useUnhideReview } from '@/lib/admin/use-admin-reviews';

vi.mock('@/lib/admin/use-admin-reviews', () => ({
  useAdminReviews: vi.fn(),
  useHideReview: vi.fn(),
  useUnhideReview: vi.fn(),
}));

function review(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'rev-1',
    appointmentId: 'apt-1',
    doctorId: 'doc-1',
    doctorDisplayName: 'Dr. Grace Hopper',
    patientId: 'pat-1',
    patientDisplayName: 'Ada Lovelace',
    rating: 4,
    comment: 'Very thorough',
    hidden: false,
    hiddenReason: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function renderPage() {
  render(
    <MemoryRouter>
      <AdminReviewsPage />
    </MemoryRouter>,
  );
}

describe('AdminReviewsPage', () => {
  it('Hides a visible review with a reason', async () => {
    vi.mocked(useAdminReviews).mockReturnValue({
      data: { items: [review()], total: 1, page: 1, pageSize: 20 },
      status: 'success',
      error: null,
      isPending: false,
      refetch: vi.fn(),
    } as never);
    const hideMutateAsync = vi.fn().mockResolvedValue(review({ hidden: true }));
    vi.mocked(useHideReview).mockReturnValue({ mutateAsync: hideMutateAsync, isPending: false } as never);
    vi.mocked(useUnhideReview).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);

    renderPage();

    expect(screen.getByText(/dr\. grace hopper/i)).toBeInTheDocument();
    expect(screen.getByText(/ada lovelace/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /^hide$/i }));
    expect(screen.getByText(/hide this review/i)).toBeInTheDocument();

    const confirmButton = screen.getByRole('button', { name: /^hide review$/i });
    expect(confirmButton).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/reason/i), 'Contains identifying details');
    expect(confirmButton).not.toBeDisabled();
    await userEvent.click(confirmButton);

    expect(hideMutateAsync).toHaveBeenCalledWith({
      id: 'rev-1',
      body: { reason: 'Contains identifying details' },
    });
  });

  it('Unhides a hidden review', async () => {
    vi.mocked(useAdminReviews).mockReturnValue({
      data: { items: [review({ hidden: true, hiddenReason: 'Under review' })], total: 1, page: 1, pageSize: 20 },
      status: 'success',
      error: null,
      isPending: false,
      refetch: vi.fn(),
    } as never);
    vi.mocked(useHideReview).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
    const unhideMutateAsync = vi.fn().mockResolvedValue(review({ hidden: false }));
    vi.mocked(useUnhideReview).mockReturnValue({ mutateAsync: unhideMutateAsync, isPending: false } as never);

    renderPage();

    expect(screen.getByRole('button', { name: /^unhide$/i })).toBeInTheDocument();
    expect(screen.getByText(/hidden reason: under review/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /^unhide$/i }));
    await userEvent.type(screen.getByLabelText(/reason/i), 'Reviewed, no policy violation');
    await userEvent.click(screen.getByRole('button', { name: /^unhide review$/i }));

    expect(unhideMutateAsync).toHaveBeenCalledWith({
      id: 'rev-1',
      body: { reason: 'Reviewed, no policy violation' },
    });
  });
});
