import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { AppointmentsController } from './appointments.controller.js';
import { AppointmentsService } from './appointments.service.js';
import { BookingRules } from './booking-rules.js';

@Module({
  imports: [NotificationsModule],
  controllers: [AppointmentsController],
  providers: [AppointmentsService, BookingRules],
})
export class AppointmentsModule {}
