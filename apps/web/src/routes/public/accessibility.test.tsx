import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { axe } from 'jest-axe';
import { PublicLayout } from '@/routes/layouts/public-layout';
import { LandingPage } from './landing';
import { TermsPage } from './terms';
import { PrivacyPage } from './privacy';
import { NotFoundPage } from './not-found';
import { apiClient } from '@/lib/api-client';
import { useCurrentUser } from '@/lib/auth/use-current-user';

vi.mock('@/lib/api-client', () => ({ apiClient: { GET: vi.fn() } }));
vi.mock('@/lib/auth/use-current-user', () => ({ useCurrentUser: vi.fn() }));

function renderPage(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [
      {
        element: <PublicLayout />,
        children: [
          { path: '/', element: <LandingPage /> },
          { path: '/terms', element: <TermsPage /> },
          { path: '/privacy', element: <PrivacyPage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
    { initialEntries: [path] },
  );
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

// jsdom can't lay out or paint, so axe-core's own color-contrast check is
// disabled by jest-axe for this environment already; contrast is verified
// separately in `lib/color-contrast.test.ts`.
async function expectNoSeriousOrCriticalViolations(container: HTMLElement) {
  const results = await axe(container);
  const seriousOrCritical = results.violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical',
  );
  expect(seriousOrCritical, JSON.stringify(seriousOrCritical, null, 2)).toEqual([]);
}

describe('Automated accessibility check', () => {
  beforeEach(() => {
    vi.mocked(apiClient.GET).mockResolvedValue({
      data: [{ id: 's1', slug: 'cardiology', name: 'Cardiology', description: '' }],
      error: undefined,
      response: new Response(null, { status: 200 }),
    } as never);
    vi.mocked(useCurrentUser).mockReturnValue({ data: null, isPending: false } as never);
  });

  it('reports no serious or critical violations on the landing, terms, privacy, and not-found pages', async () => {
    const landing = renderPage('/');
    await expectNoSeriousOrCriticalViolations(landing.container);
    landing.unmount();

    const terms = renderPage('/terms');
    await expectNoSeriousOrCriticalViolations(terms.container);
    terms.unmount();

    const privacy = renderPage('/privacy');
    await expectNoSeriousOrCriticalViolations(privacy.container);
    privacy.unmount();

    const notFound = renderPage('/no-such-page');
    await expectNoSeriousOrCriticalViolations(notFound.container);
    notFound.unmount();
  }, 20_000);
});
