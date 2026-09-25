import { Module } from '@nestjs/common';
import { AppointmentsController } from './appointments.controller.js';
import { AppointmentsService } from './appointments.service.js';
import { BookingRules } from './booking-rules.js';

@Module({
  controllers: [AppointmentsController],
  providers: [AppointmentsService, BookingRules],
})
export class AppointmentsModule {}
