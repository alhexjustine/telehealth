import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { NotificationBell } from './notification-bell';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadCount,
} from '@/lib/notifications/use-notifications';

vi.mock('@/lib/notifications/use-notifications', () => ({
  useNotifications: vi.fn(),
  useUnreadCount: vi.fn(),
  useMarkNotificationRead: vi.fn(),
  useMarkAllNotificationsRead: vi.fn(),
}));

function renderBell() {
  const router = createMemoryRouter(
    [
      { path: '/doctor', element: <NotificationBell role="DOCTOR" /> },
      { path: '/doctor/appointments/:id', element: <div>Appointment detail page</div> },
    ],
    { initialEntries: ['/doctor'] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

describe('NotificationBell', () => {
  it('Open a notification', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    vi.mocked(useMarkNotificationRead).mockReturnValue({ mutateAsync } as never);
    vi.mocked(useMarkAllNotificationsRead).mockReturnValue({ mutateAsync: vi.fn() } as never);
    vi.mocked(useUnreadCount).mockReturnValue({ data: { unreadCount: 1 } } as never);
    vi.mocked(useNotifications).mockReturnValue({
      isPending: false,
      data: {
        items: [
          {
            id: 'n1',
            type: 'APPOINTMENT_CANCELLED',
            title: 'Appointment cancelled',
            body: 'Cancelled by Ada Lovelace',
            data: null,
            link: '/doctor/appointments/apt-1',
            appointmentId: 'apt-1',
            readAt: null,
            createdAt: new Date().toISOString(),
          },
        ],
        total: 1,
        page: 1,
        pageSize: 10,
        unreadCount: 1,
      },
    } as never);

    const router = renderBell();
    await userEvent.click(screen.getByRole('button', { name: /notifications/i }));
    await userEvent.click(await screen.findByText('Appointment cancelled'));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith('n1'));
    await waitFor(() => expect(router.state.location.pathname).toBe('/doctor/appointments/apt-1'));
  });

  it('Empty state', async () => {
    vi.mocked(useMarkNotificationRead).mockReturnValue({ mutateAsync: vi.fn() } as never);
    vi.mocked(useMarkAllNotificationsRead).mockReturnValue({ mutateAsync: vi.fn() } as never);
    vi.mocked(useUnreadCount).mockReturnValue({ data: { unreadCount: 0 } } as never);
    vi.mocked(useNotifications).mockReturnValue({
      isPending: false,
      data: { items: [], total: 0, page: 1, pageSize: 10, unreadCount: 0 },
    } as never);

    renderBell();
    await userEvent.click(screen.getByRole('button', { name: /notifications/i }));

    expect(await screen.findByText(/you.re all caught up/i)).toBeInTheDocument();
  });
});
