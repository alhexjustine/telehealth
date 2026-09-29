import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  it('Confirm password must match password', async () => {
    const mutateAsync = vi.fn();
    vi.mocked(useRegisterPatientMutation).mockReturnValue({
      mutateAsync,
      isPending: false,
      isError: false,
    } as never);

    renderPage();

    await userEvent.type(screen.getByLabelText(/^first name$/i), 'Ada');
    await userEvent.type(screen.getByLabelText(/^last name$/i), 'Lovelace');
    await userEvent.type(screen.getByLabelText(/^email$/i), 'ada@example.com');
    await userEvent.type(screen.getByLabelText(/^password$/i), 'correct-horse-battery');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'correct-horse-battery-typo');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('Submits without the confirm-password field once passwords match', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ role: 'PATIENT' });
    vi.mocked(useRegisterPatientMutation).mockReturnValue({
      mutateAsync,
      isPending: false,
      isError: false,
    } as never);

    renderPage();

    await userEvent.type(screen.getByLabelText(/^first name$/i), 'Ada');
    await userEvent.type(screen.getByLabelText(/^last name$/i), 'Lovelace');
    await userEvent.type(screen.getByLabelText(/^email$/i), 'ada@example.com');
    await userEvent.type(screen.getByLabelText(/^password$/i), 'correct-horse-battery');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'correct-horse-battery');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@example.com',
        password: 'correct-horse-battery',
      }),
    );
  });
});
