import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { RealtimeModule } from '../realtime/realtime.module.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';
import { ReminderService } from './reminder.service.js';

// Read directly rather than through `ConfigService`: `@Module()`'s arrays are
// evaluated at class-definition time, before Nest builds the DI container.
// `ReminderService` is always a provider — e2e tests call its `run(now)`
// directly with an injected clock — but `@nestjs/schedule`'s explorer (which
// actually scans for `@Cron`-decorated methods and starts the timer) only
// runs when `ScheduleModule.forRoot()` is imported. Skipping that import
// when `REMINDERS_ENABLED=false` (tests, CI, OpenAPI generation) leaves the
// `@Cron` metadata on the class inert, so no timer keeps Jest or the
// generator script alive, while `run()` stays directly callable.
const remindersEnabled = process.env.REMINDERS_ENABLED !== 'false';

@Module({
  imports: [RealtimeModule, ...(remindersEnabled ? [ScheduleModule.forRoot()] : [])],
  controllers: [NotificationsController],
  providers: [NotificationsService, ReminderService],
  exports: [NotificationsService, ReminderService],
})
export class NotificationsModule {}
