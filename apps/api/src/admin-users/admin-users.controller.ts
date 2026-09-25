import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthUser } from '../auth/current-user.js';
import { Role } from '../generated/prisma/enums.js';
import { ErrorResponseDto } from '../common/dto/error-response.dto.js';
import { AdminUsersService } from './admin-users.service.js';
import { AdminUserListQueryDto } from './dto/admin-user-list-query.dto.js';
import { ChangeAccountStatusDto } from './dto/change-account-status.dto.js';
import { AdminUserListResponseDto, AdminUserResponseDto } from './dto/admin-user-response.dto.js';

@ApiTags('admin-users')
@ApiCookieAuth('th_session')
@Controller('admin/users')
@Roles(Role.ADMIN)
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  @ApiOperation({ summary: 'Lists accounts, filtered by role/status/text query, newest first' })
  @ApiOkResponse({ type: AdminUserListResponseDto })
  async list(@Query() query: AdminUserListQueryDto): Promise<AdminUserListResponseDto> {
    return this.adminUsersService.list(query);
  }

  @Post(':id/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Changes a patient or doctor account's status, with a required reason" })
  @ApiOkResponse({ type: AdminUserResponseDto })
  @ApiResponse({ status: 409, description: 'STATUS_UNCHANGED', type: ErrorResponseDto })
  async changeStatus(
    @CurrentUser() admin: AuthUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: ChangeAccountStatusDto,
  ): Promise<AdminUserResponseDto> {
    return this.adminUsersService.changeStatus(admin.id, id, dto);
  }
}
