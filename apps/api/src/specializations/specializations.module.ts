import { Module } from '@nestjs/common';
import { SpecializationsService } from './specializations.service.js';
import { SpecializationsController } from './specializations.controller.js';

@Module({
  controllers: [SpecializationsController],
  providers: [SpecializationsService],
  exports: [SpecializationsService],
})
export class SpecializationsModule {}
