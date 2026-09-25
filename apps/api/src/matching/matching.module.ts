import { Module } from '@nestjs/common';
import { AvailabilityModule } from '../availability/availability.module.js';
import { SymptomsController } from './symptoms.controller.js';
import { SymptomsService } from './symptoms.service.js';
import { MatchingController } from './matching.controller.js';
import { MatchingService } from './matching.service.js';

@Module({
  imports: [AvailabilityModule],
  controllers: [SymptomsController, MatchingController],
  providers: [SymptomsService, MatchingService],
})
export class MatchingModule {}
