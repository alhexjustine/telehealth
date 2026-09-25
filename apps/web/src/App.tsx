import { createBrowserRouter, RouterProvider } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/query-client';
import { RootPage } from '@/routes/root';
import { StatusPage } from '@/routes/status';

const router = createBrowserRouter([
  { path: '/', element: <RootPage /> },
  { path: '/status', element: <StatusPage /> },
]);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
