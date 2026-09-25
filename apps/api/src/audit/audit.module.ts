import { Module } from '@nestjs/common';
import { AuditService } from './audit.service.js';
import { AuditQueryService } from './audit-query.service.js';
import { AuditController } from './audit.controller.js';

@Module({
  controllers: [AuditController],
  providers: [AuditService, AuditQueryService],
  exports: [AuditService],
})
export class AuditModule {}
