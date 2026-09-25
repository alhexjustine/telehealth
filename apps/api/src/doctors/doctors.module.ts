import { Module } from '@nestjs/common';
import { SpecializationsModule } from '../specializations/specializations.module.js';
import { DoctorsController } from './doctors.controller.js';
import { DoctorsService } from './doctors.service.js';

@Module({
  imports: [SpecializationsModule],
  controllers: [DoctorsController],
  providers: [DoctorsService],
})
export class DoctorsModule {}
