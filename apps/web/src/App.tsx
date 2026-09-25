import { RouterProvider } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/query-client';
import { router } from '@/router';
import { onSessionEnded } from '@/lib/api-client';
import { markSessionEnded } from '@/lib/session-ended';
import { sanitizeReturnTo } from '@/lib/return-to';
import { Toaster } from '@/components/ui/sonner';

// Wired here (not in api-client.ts) because this is the one place that
// depends on both the api-client and the router without creating a circular
// import between them. Per the `ui-resilience` spec's "Session-ended
// experience": clears cached data, flags the sign-in page to show the
// "session has ended" message once, and carries the current page as
// `returnTo` (sanitized the same way every other `returnTo` is) so signing in
// again lands back where the user was.
onSessionEnded(() => {
  const here = sanitizeReturnTo(`${window.location.pathname}${window.location.search}`);
  queryClient.clear();
  markSessionEnded();
  const returnTo = here && here !== '/login' ? `?returnTo=${encodeURIComponent(here)}` : '';
  void router.navigate(`/login${returnTo}`);
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster />
    </QueryClientProvider>
  );
}
