import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Role } from '../generated/prisma/enums.js';
import { AuditQueryService } from './audit-query.service.js';
import { AuditLogListQueryDto } from './dto/audit-log-list-query.dto.js';
import { AuditLogEntryDto, AuditLogListResponseDto } from './dto/audit-log-response.dto.js';

/**
 * Read-only: only `GET` routes exist here, so a PATCH/PUT/DELETE to any
 * `/admin/audit...` path doesn't match a route at all and falls through to
 * the framework's default 404 — see the `audit-log` spec's "No API to
 * change entries".
 */
@ApiTags('audit-log')
@ApiCookieAuth('th_session')
@Controller('admin/audit')
@Roles(Role.ADMIN)
export class AuditController {
  constructor(private readonly auditQueryService: AuditQueryService) {}

  @Get()
  @ApiOperation({ summary: 'Lists audit entries, newest first, filtered by action/actor/affected record/date range' })
  @ApiOkResponse({ type: AuditLogListResponseDto })
  async list(@Query() query: AuditLogListQueryDto): Promise<AuditLogListResponseDto> {
    return this.auditQueryService.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'A single audit entry, with its before/after values' })
  @ApiOkResponse({ type: AuditLogEntryDto })
  async detail(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<AuditLogEntryDto> {
    return this.auditQueryService.detail(id);
  }
}
