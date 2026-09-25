import { Module } from '@nestjs/common';
import { AppointmentsModule } from '../appointments/appointments.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { AdminAppointmentsController } from './admin-appointments.controller.js';
import { AdminAppointmentsService } from './admin-appointments.service.js';

@Module({
  imports: [AppointmentsModule, NotificationsModule, AuditModule],
  controllers: [AdminAppointmentsController],
  providers: [AdminAppointmentsService],
})
export class AdminAppointmentsModule {}
