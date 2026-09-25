import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { JoinConsultationButton } from './join-consultation-button';

function renderButton(props: Partial<Parameters<typeof JoinConsultationButton>[0]> = {}) {
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
});
