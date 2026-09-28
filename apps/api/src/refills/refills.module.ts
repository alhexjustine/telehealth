import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { RefillsController, DoctorRefillsController } from './refills.controller.js';
import { RefillsService } from './refills.service.js';

@Module({
  imports: [NotificationsModule],
  controllers: [RefillsController, DoctorRefillsController],
  providers: [RefillsService],
})
export class RefillsModule {}
