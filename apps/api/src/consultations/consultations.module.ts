import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { RealtimeModule } from '../realtime/realtime.module.js';
import { ConsultationsController } from './consultations.controller.js';
import { ConsultationsService } from './consultations.service.js';

@Module({
  imports: [NotificationsModule, RealtimeModule],
  controllers: [ConsultationsController],
  providers: [ConsultationsService],
  exports: [ConsultationsService],
})
export class ConsultationsModule {}
