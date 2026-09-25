import { Controller, Get, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Role } from '../generated/prisma/enums.js';
import { AdminDashboardService } from './admin-dashboard.service.js';
import { AdminDashboardQueryDto } from './dto/admin-dashboard-query.dto.js';
import { AdminDashboardResponseDto } from './dto/admin-dashboard-response.dto.js';

@ApiTags('admin-dashboard')
@ApiCookieAuth('th_session')
@Controller('admin/dashboard')
@Roles(Role.ADMIN)
export class AdminDashboardController {
  constructor(private readonly adminDashboardService: AdminDashboardService) {}

  @Get()
  @ApiOperation({ summary: 'Operational counts computed from the database, plus a 29-day appointment trend' })
  @ApiOkResponse({ type: AdminDashboardResponseDto })
  async get(@Query() query: AdminDashboardQueryDto): Promise<AdminDashboardResponseDto> {
    return this.adminDashboardService.get(query);
  }
}
