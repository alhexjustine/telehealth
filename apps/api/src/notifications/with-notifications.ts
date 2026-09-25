import type { Notification, Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsService } from './notifications.service.js';
import type { NotificationDraft } from './notification.types.js';

export interface WithNotificationsResult<T> {
  result: T;
  notifications: Notification[];
}

/**
 * Runs `fn` inside a fresh transaction, handing it a `notify` callback that
 * stages notification drafts in that same transaction. If `fn` throws, the
 * transaction rolls back and nothing is published (see design.md's
 * "Transactional write, post-commit publish"). The caller is expected to
 * pass `notifications` to `NotificationsService.publish` once this resolves,
 * which is only ever reached after commit.
 */
export async function withNotifications<T>(
  prisma: PrismaService,
  notifications: NotificationsService,
  fn: (
    tx: Prisma.TransactionClient,
    notify: (drafts: NotificationDraft[]) => Promise<void>,
  ) => Promise<T>,
): Promise<WithNotificationsResult<T>> {
  const staged: Notification[] = [];

  const result = await prisma.$transaction(async (tx) => {
    const notify = async (drafts: NotificationDraft[]): Promise<void> => {
      if (drafts.length === 0) return;
      const created = await notifications.stage(tx, drafts);
      staged.push(...created);
    };
    return fn(tx, notify);
  });

  return { result, notifications: staged };
}
