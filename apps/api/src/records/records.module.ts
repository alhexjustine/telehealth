import { Module } from '@nestjs/common';
import { ConsultationRecordsController } from './consultation-records.controller.js';
import { RecordsController } from './records.controller.js';
import { RecordsService } from './records.service.js';

@Module({
  controllers: [ConsultationRecordsController, RecordsController],
  providers: [RecordsService],
  exports: [RecordsService],
})
export class RecordsModule {}
