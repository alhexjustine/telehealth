import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { RealtimeModule } from '../realtime/realtime.module.js';
import { RateLimitGuard } from '../common/rate-limit/rate-limit.guard.js';
import { MessagesController } from './messages.controller.js';
import { MessagesService } from './messages.service.js';

@Module({
  imports: [NotificationsModule, RealtimeModule],
  controllers: [MessagesController],
  // `RateLimitGuard` is only provided by `AuthModule` (not exported), so every
  // module that references it in `@UseGuards` must provide its own instance.
  providers: [MessagesService, RateLimitGuard],
})
export class MessagesModule {}
