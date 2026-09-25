import { Module } from '@nestjs/common';
import { SpecializationsModule } from '../specializations/specializations.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { AdminDoctorsController } from './admin-doctors.controller.js';
import { AdminDoctorsService } from './admin-doctors.service.js';

@Module({
  imports: [SpecializationsModule, NotificationsModule, AuditModule],
  controllers: [AdminDoctorsController],
  providers: [AdminDoctorsService],
})
export class AdminDoctorsModule {}
