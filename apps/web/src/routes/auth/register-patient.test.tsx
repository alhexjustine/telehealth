import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { RegisterPatientPage } from './register-patient';
import { useRegisterPatientMutation } from '@/lib/auth/mutations';

vi.mock('@/lib/auth/mutations', () => ({ useRegisterPatientMutation: vi.fn() }));

function renderPage() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <RegisterPatientPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('RegisterPatientPage', () => {
  it('Disclaimer on registration', () => {
    vi.mocked(useRegisterPatientMutation).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      isError: false,
    } as never);

    renderPage();

    // Rendered above the form: it appears before the submit button in DOM order.
    const disclaimer = screen.getByText(/fictional-prototype telehealth product/i);
    const submit = screen.getByRole('button', { name: /create account/i });
    expect(
      disclaimer.compareDocumentPosition(submit) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('Links from registration', () => {
    vi.mocked(useRegisterPatientMutation).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      isError: false,
    } as never);

    renderPage();

    expect(screen.getByRole('link', { name: /^terms$/i })).toHaveAttribute('href', '/terms');
    expect(screen.getByRole('link', { name: /privacy policy/i })).toHaveAttribute(
      'href',
      '/privacy',
    );
  });
});
