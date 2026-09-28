import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { JoinConsultationButton } from './join-consultation-button';
import { useCurrentUser } from '@/lib/auth/use-current-user';

vi.mock('@/lib/auth/use-current-user', () => ({ useCurrentUser: vi.fn() }));

function renderButton(
  props: Partial<Parameters<typeof JoinConsultationButton>[0]> = {},
  joinWindowDisabled = false,
) {
  vi.mocked(useCurrentUser).mockReturnValue({ data: { joinWindowDisabled } } as never);
  render(
    <MemoryRouter>
      <JoinConsultationButton
        appointmentId="apt-1"
        status="BOOKED"
        startsAt={new Date(Date.now() + 10 * 60_000).toISOString()}
        endsAt={new Date(Date.now() + 40 * 60_000).toISOString()}
        {...props}
      />
    </MemoryRouter>,
  );
}

describe('JoinConsultationButton', () => {
  it('Join action appears in the window', () => {
    renderButton();
    const link = screen.getByRole('link', { name: /join consultation/i });
    expect(link).toHaveAttribute('href', '/consultations/apt-1');
  });

  it('is hidden before the window opens', () => {
    renderButton({
      startsAt: new Date(Date.now() + 40 * 60_000).toISOString(),
      endsAt: new Date(Date.now() + 70 * 60_000).toISOString(),
    });
    expect(screen.queryByRole('link', { name: /join consultation/i })).not.toBeInTheDocument();
  });

  it('is hidden once the appointment is no longer BOOKED', () => {
    renderButton({ status: 'CANCELLED' });
    expect(screen.queryByRole('link', { name: /join consultation/i })).not.toBeInTheDocument();
  });

  it('appears outside the window when joinWindowDisabled (testing-only escape hatch)', () => {
    renderButton(
      {
        startsAt: new Date(Date.now() + 40 * 60_000).toISOString(),
        endsAt: new Date(Date.now() + 70 * 60_000).toISOString(),
      },
      true,
    );
    expect(screen.getByRole('link', { name: /join consultation/i })).toBeInTheDocument();
  });
});
