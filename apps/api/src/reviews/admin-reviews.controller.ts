import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthUser } from '../auth/current-user.js';
import { Role } from '../generated/prisma/enums.js';
import { ErrorResponseDto } from '../common/dto/error-response.dto.js';
import { AdminReviewsService } from './admin-reviews.service.js';
import { AdminReviewListQueryDto } from './dto/admin-review-query.dto.js';
import { ModerateReviewDto } from './dto/moderate-review.dto.js';
import { AdminReviewDto, AdminReviewListResponseDto } from './dto/admin-review-response.dto.js';

@ApiTags('admin-reviews')
@ApiCookieAuth('th_session')
@Controller('admin/reviews')
@Roles(Role.ADMIN)
export class AdminReviewsController {
  constructor(private readonly adminReviewsService: AdminReviewsService) {}

  @Get()
  @ApiOperation({ summary: 'Lists reviews, including hidden ones, filtered by doctor and hidden status' })
  @ApiOkResponse({ type: AdminReviewListResponseDto })
  async list(@Query() query: AdminReviewListQueryDto): Promise<AdminReviewListResponseDto> {
    return this.adminReviewsService.list(query);
  }

  @Post(':id/hide')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Hides a review with a required reason' })
  @ApiOkResponse({ type: AdminReviewDto })
  @ApiResponse({ status: 409, description: 'REVIEW_HIDE_STATUS_UNCHANGED', type: ErrorResponseDto })
  async hide(
    @CurrentUser() admin: AuthUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: ModerateReviewDto,
  ): Promise<AdminReviewDto> {
    return this.adminReviewsService.hide(admin.id, id, dto.reason.trim());
  }

  @Post(':id/unhide')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unhides a previously hidden review with a required reason' })
  @ApiOkResponse({ type: AdminReviewDto })
  @ApiResponse({ status: 409, description: 'REVIEW_HIDE_STATUS_UNCHANGED', type: ErrorResponseDto })
  async unhide(
    @CurrentUser() admin: AuthUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: ModerateReviewDto,
  ): Promise<AdminReviewDto> {
    return this.adminReviewsService.unhide(admin.id, id, dto.reason.trim());
  }
}
