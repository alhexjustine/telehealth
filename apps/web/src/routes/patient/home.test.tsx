import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { PatientHomePage } from './home';
import { useCurrentUser } from '@/lib/auth/use-current-user';

vi.mock('@/lib/auth/use-current-user', () => ({ useCurrentUser: vi.fn() }));

function renderHome() {
  render(
    <MemoryRouter>
      <PatientHomePage />
    </MemoryRouter>,
  );
}

describe('PatientHomePage', () => {
  it('Incomplete profile prompt', () => {
    vi.mocked(useCurrentUser).mockReturnValue({
      data: {
        id: '1',
        email: 'p@example.com',
        role: 'PATIENT',
        status: 'ACTIVE',
        displayName: 'Ada Lovelace',
        profileComplete: false,
      },
    } as never);

    renderHome();

    expect(screen.getByText('Complete your profile')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /go to your profile/i })).toHaveAttribute(
      'href',
      '/patient/profile',
    );
  });

  it('does not show the prompt once the profile is complete', () => {
    vi.mocked(useCurrentUser).mockReturnValue({
      data: {
        id: '1',
        email: 'p@example.com',
        role: 'PATIENT',
        status: 'ACTIVE',
        displayName: 'Ada Lovelace',
        profileComplete: true,
      },
    } as never);

    renderHome();

    expect(screen.queryByText(/complete your profile/i)).not.toBeInTheDocument();
  });
});
