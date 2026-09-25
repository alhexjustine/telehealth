import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { LandingPage } from './landing';
import { apiClient } from '@/lib/api-client';
import { landingContent } from '@/content/landing';

vi.mock('@/lib/api-client', () => ({
  apiClient: { GET: vi.fn() },
}));

function renderLanding() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('LandingPage', () => {
  it('Visitor sees the landing page', async () => {
    vi.mocked(apiClient.GET).mockResolvedValue({
      data: [{ id: 's1', slug: 'cardiology', name: 'Cardiology', description: '' }],
      error: undefined,
      response: new Response(null, { status: 200 }),
    } as never);

    renderLanding();

    // The hero is the page's one h1, and shows both calls to action.
    const heroHeading = screen.getByRole('heading', {
      level: 1,
      name: landingContent.hero.headline,
    });
    expect(heroHeading).toBeInTheDocument();
    // The primary/secondary CTAs are unique to the hero; "Join as a doctor"
    // also appears again in the "For doctors" section further down the page.
    const heroSection = heroHeading.closest('section');
    expect(heroSection).not.toBeNull();
    const hero = within(heroSection as HTMLElement);
    expect(hero.getByRole('link', { name: landingContent.hero.primaryCta.label })).toHaveAttribute(
      'href',
      '/register/patient',
    );
    expect(hero.getByRole('link', { name: landingContent.hero.secondaryCta.label })).toHaveAttribute(
      'href',
      '/register/doctor',
    );

    // Every listed section is present, in order.
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual([
      landingContent.capabilities.heading,
      landingContent.howItWorks.heading,
      landingContent.forDoctors.heading,
      landingContent.specializations.heading,
      landingContent.trust.heading,
      landingContent.faq.heading,
    ]);

    await waitFor(() => expect(screen.getByText('Cardiology')).toBeInTheDocument());
  });

  it('Specializations from the catalog', async () => {
    vi.mocked(apiClient.GET).mockResolvedValue({
      data: [
        { id: 's1', slug: 'cardiology', name: 'Cardiology', description: '' },
        { id: 's2', slug: 'dermatology', name: 'Dermatology', description: '' },
      ],
      error: undefined,
      response: new Response(null, { status: 200 }),
    } as never);

    renderLanding();

    await waitFor(() => expect(screen.getByText('Cardiology')).toBeInTheDocument());
    expect(screen.getByText('Dermatology')).toBeInTheDocument();
  });

  it('Catalog unavailable', async () => {
    vi.mocked(apiClient.GET).mockResolvedValue({
      data: undefined,
      error: { message: 'Down' },
      response: new Response(null, { status: 500 }),
    } as never);

    renderLanding();

    await waitFor(() =>
      expect(screen.getByText(landingContent.specializations.fallback)).toBeInTheDocument(),
    );
    // The rest of the page still renders.
    expect(
      screen.getByRole('heading', { level: 2, name: landingContent.trust.heading }),
    ).toBeInTheDocument();
  });

  it('Emergency notice', () => {
    vi.mocked(apiClient.GET).mockResolvedValue({
      data: [],
      error: undefined,
      response: new Response(null, { status: 200 }),
    } as never);

    renderLanding();

    expect(screen.getByText('Not for emergencies')).toBeInTheDocument();
    expect(screen.getByText(/contact your local emergency services/i)).toBeInTheDocument();
  });
});
