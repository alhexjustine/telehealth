import type { Notification } from '../generated/prisma/client.js';
import type { NotificationResponseDto } from './dto/notification-response.dto.js';

export function toNotificationResponseDto(notification: Notification): NotificationResponseDto {
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    data: (notification.data as Record<string, unknown> | null) ?? null,
    link: notification.link,
    appointmentId: notification.appointmentId,
    readAt: notification.readAt ? notification.readAt.toISOString() : null,
    createdAt: notification.createdAt.toISOString(),
  };
}
