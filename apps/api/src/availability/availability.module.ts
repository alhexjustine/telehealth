import { Module } from '@nestjs/common';
import { AvailabilityController } from './availability.controller.js';
import { SlotsController } from './slots.controller.js';
import { AvailabilityService } from './availability.service.js';

@Module({
  controllers: [AvailabilityController, SlotsController],
  providers: [AvailabilityService],
})
export class AvailabilityModule {}
