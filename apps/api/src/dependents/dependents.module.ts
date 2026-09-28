import { Module } from '@nestjs/common';
import { DependentsController } from './dependents.controller.js';
import { DependentsService } from './dependents.service.js';

@Module({
  controllers: [DependentsController],
  providers: [DependentsService],
})
export class DependentsModule {}
