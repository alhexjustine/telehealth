import { RouterProvider } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/query-client';
import { router } from '@/router';
import { onSessionEnded } from '@/lib/api-client';
import { Toaster } from '@/components/ui/sonner';

// Wired here (not in api-client.ts) because this is the one place that
// depends on both the api-client and the router without creating a circular
// import between them.
onSessionEnded(() => {
  queryClient.clear();
  void router.navigate('/login');
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster />
    </QueryClientProvider>
  );
}
