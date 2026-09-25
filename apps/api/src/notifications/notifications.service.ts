import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Notification, Prisma } from '../generated/prisma/client.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import { toNotificationResponseDto } from './notification-mapper.js';
import type { NotificationListResponseDto, NotificationResponseDto } from './dto/notification-response.dto.js';
import type { NotificationDraft } from './notification.types.js';

export interface ListNotificationsOptions {
  unreadOnly: boolean;
  page: number;
  pageSize: number;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  /**
   * Inserts one row per draft inside the caller's own transaction (`tx`) and
   * returns them — see design.md's "Transactional write, post-commit
   * publish". Never call this outside a transaction the caller controls; use
   * `withNotifications` for the common case.
   */
  async stage(tx: Prisma.TransactionClient, drafts: NotificationDraft[]): Promise<Notification[]> {
    const created: Notification[] = [];
    for (const draft of drafts) {
      created.push(await tx.notification.create({ data: draft }));
    }
    return created;
  }

  /** Only reachable after the writing transaction has committed. */
  async publish(notifications: Notification[]): Promise<void> {
    if (notifications.length === 0) return;
    await this.realtimeGateway.publish(notifications);
  }

  async list(userId: string, options: ListNotificationsOptions): Promise<NotificationListResponseDto> {
    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(options.unreadOnly ? { readAt: null } : {}),
    };

    const [items, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (options.page - 1) * options.pageSize,
        take: options.pageSize,
      }),
      this.prisma.notification.count({ where }),
      this.unreadCount(userId),
    ]);

    return {
      items: items.map(toNotificationResponseDto),
      total,
      page: options.page,
      pageSize: options.pageSize,
      unreadCount,
    };
  }

  async unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  async markRead(userId: string, id: string): Promise<NotificationResponseDto> {
    const existing = await this.prisma.notification.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      throw new NotFoundException('Notification not found');
    }

    const updated = existing.readAt
      ? existing
      : await this.prisma.notification.update({ where: { id }, data: { readAt: new Date() } });

    this.realtimeGateway.pushUnreadCount(userId, await this.unreadCount(userId));
    return toNotificationResponseDto(updated);
  }

  async markAllRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
    this.realtimeGateway.pushUnreadCount(userId, 0);
  }
}
