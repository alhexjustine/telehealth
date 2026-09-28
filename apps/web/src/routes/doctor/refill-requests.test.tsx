import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { DoctorRefillRequestsPage } from './refill-requests';
import { useApproveRefill, useDenyRefill, useDoctorRefillRequests } from '@/lib/refills/use-doctor-refills';

vi.mock('@/lib/refills/use-doctor-refills', () => ({
  useDoctorRefillRequests: vi.fn(),
  useApproveRefill: vi.fn(),
  useDenyRefill: vi.fn(),
}));

function refillRequest(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'refill-1',
    appointmentId: 'apt-1',
    prescriptionId: 'rx-1',
    medication: 'Amoxicillin',
    appointmentStartsAt: '2026-01-01T10:00:00.000Z',
    patient: { id: 'pat-1', displayName: 'Ada Lovelace', age: 36 },
    dependent: null,
    status: 'PENDING',
    patientNote: 'still symptomatic',
    doctorNote: null,
    decidedAt: null,
    createdAt: '2026-01-02T00:00:00.000Z',
    ...overrides,
  };
}

function renderPage() {
  render(
    <MemoryRouter>
      <DoctorRefillRequestsPage />
    </MemoryRouter>,
  );
}

describe('DoctorRefillRequestsPage', () => {
  it('Doctor approves a request', async () => {
    vi.mocked(useDoctorRefillRequests).mockReturnValue({
      data: { items: [refillRequest()], total: 1, page: 1, pageSize: 20 },
      status: 'success',
      error: null,
      isPending: false,
      refetch: vi.fn(),
    } as never);
    const approveMutateAsync = vi.fn().mockResolvedValue(refillRequest({ status: 'APPROVED' }));
    vi.mocked(useApproveRefill).mockReturnValue({ mutateAsync: approveMutateAsync, isPending: false } as never);
    vi.mocked(useDenyRefill).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);

    renderPage();

    expect(screen.getByText(/ada lovelace/i)).toBeInTheDocument();
    expect(screen.getByText(/still symptomatic/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /view patient record/i })).toHaveAttribute(
      'href',
      '/doctor/patients/pat-1',
    );

    await userEvent.click(screen.getByRole('button', { name: /^approve$/i }));
    await userEvent.type(screen.getByPlaceholderText(/optional note/i), 'Renewed for another 30 days');

    // The dialog's confirm button shares the "Approve" label with the card's trigger button.
    const confirmButtons = screen.getAllByRole('button', { name: /^approve$/i });
    await userEvent.click(confirmButtons[confirmButtons.length - 1]!);

    expect(approveMutateAsync).toHaveBeenCalledWith({ id: 'refill-1', doctorNote: 'Renewed for another 30 days' });
  });

  it('Doctor denies a request', async () => {
    vi.mocked(useDoctorRefillRequests).mockReturnValue({
      data: { items: [refillRequest()], total: 1, page: 1, pageSize: 20 },
      status: 'success',
      error: null,
      isPending: false,
      refetch: vi.fn(),
    } as never);
    vi.mocked(useApproveRefill).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
    const denyMutateAsync = vi.fn().mockResolvedValue(refillRequest({ status: 'DENIED' }));
    vi.mocked(useDenyRefill).mockReturnValue({ mutateAsync: denyMutateAsync, isPending: false } as never);

    renderPage();

    await userEvent.click(screen.getByRole('button', { name: /^deny$/i }));
    await userEvent.type(screen.getByPlaceholderText(/optional note/i), 'Please book a follow-up first');
    const confirmButtons = screen.getAllByRole('button', { name: /^deny$/i });
    await userEvent.click(confirmButtons[confirmButtons.length - 1]!);

    expect(denyMutateAsync).toHaveBeenCalledWith({ id: 'refill-1', doctorNote: 'Please book a follow-up first' });
  });

  it('No pending refill requests', () => {
    vi.mocked(useDoctorRefillRequests).mockReturnValue({
      data: { items: [], total: 0, page: 1, pageSize: 20 },
      status: 'success',
      error: null,
      isPending: false,
      refetch: vi.fn(),
    } as never);
    vi.mocked(useApproveRefill).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
    vi.mocked(useDenyRefill).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);

    renderPage();

    expect(screen.getByText(/no pending refill requests/i)).toBeInTheDocument();
  });

  it('Links to the dependent-scoped patient record when the request is for a dependent', () => {
    vi.mocked(useDoctorRefillRequests).mockReturnValue({
      data: {
        items: [
          refillRequest({
            dependent: { id: 'dep-1', displayName: 'Jamie Lovelace', relationship: 'CHILD' },
          }),
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      },
      status: 'success',
      error: null,
      isPending: false,
      refetch: vi.fn(),
    } as never);
    vi.mocked(useApproveRefill).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
    vi.mocked(useDenyRefill).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);

    renderPage();

    expect(screen.getByRole('link', { name: /view patient record/i })).toHaveAttribute(
      'href',
      '/doctor/patients/pat-1?dependentId=dep-1',
    );
  });

  it('Switch to the Approved tab shows decided requests without action buttons', async () => {
    vi.mocked(useDoctorRefillRequests).mockImplementation(((status?: string) => {
      if (status === 'APPROVED') {
        return {
          data: {
            items: [
              refillRequest({
                id: 'refill-2',
                status: 'APPROVED',
                patientNote: null,
                doctorNote: 'Renewed for another 30 days',
                decidedAt: '2026-01-03T00:00:00.000Z',
              }),
            ],
            total: 1,
            page: 1,
            pageSize: 20,
          },
          status: 'success',
          error: null,
          isPending: false,
          refetch: vi.fn(),
        };
      }
      return { data: { items: [], total: 0, page: 1, pageSize: 20 }, status: 'success', error: null, isPending: false, refetch: vi.fn() };
    }) as never);
    vi.mocked(useApproveRefill).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
    vi.mocked(useDenyRefill).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);

    renderPage();

    await userEvent.click(screen.getByRole('tab', { name: /^approved$/i }));

    expect(await screen.findByText(/ada lovelace/i)).toBeInTheDocument();
    expect(screen.getByText(/renewed for another 30 days/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^approve$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^deny$/i })).not.toBeInTheDocument();
  });
});
