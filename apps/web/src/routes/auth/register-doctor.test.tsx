import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { RegisterDoctorPage } from './register-doctor';
import { useRegisterDoctorMutation } from '@/lib/auth/mutations';
import { apiClient } from '@/lib/api-client';

vi.mock('@/lib/auth/mutations', () => ({ useRegisterDoctorMutation: vi.fn() }));
vi.mock('@/lib/api-client', () => ({ apiClient: { GET: vi.fn() } }));

function renderPage() {
  vi.mocked(apiClient.GET).mockResolvedValue({
    data: [],
    error: undefined,
    response: new Response(null, { status: 200 }),
  } as never);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <RegisterDoctorPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('RegisterDoctorPage', () => {
  it('Disclaimer on registration', () => {
    vi.mocked(useRegisterDoctorMutation).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      isError: false,
    } as never);

    renderPage();

    const disclaimer = screen.getByText(/fictional-prototype telehealth product/i);
    const submit = screen.getByRole('button', { name: /create account/i });
    expect(
      disclaimer.compareDocumentPosition(submit) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('Links from registration', () => {
    vi.mocked(useRegisterDoctorMutation).mockReturnValue({
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
    vi.mocked(useRegisterDoctorMutation).mockReturnValue({
      mutateAsync,
      isPending: false,
      isError: false,
    } as never);

    renderPage();

    await userEvent.type(screen.getByLabelText(/^password$/i), 'correct-horse-battery');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'correct-horse-battery-typo');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
  });
});
