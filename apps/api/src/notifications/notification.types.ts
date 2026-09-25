import type { Prisma } from '../generated/prisma/client.js';
import type { NotificationType } from '../generated/prisma/enums.js';

/** What a feature service passes to `NotificationsService.stage`/`withNotifications`'s `notify`. */
export interface NotificationDraft {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Prisma.InputJsonValue;
  link?: string;
  appointmentId?: string;
  /** Only reminders set this; appointment-event notifications don't need dedup. */
  dedupeKey?: string;
}
