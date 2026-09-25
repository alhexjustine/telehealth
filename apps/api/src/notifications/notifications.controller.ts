import { Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthUser } from '../auth/current-user.js';
import {
  DEFAULT_NOTIFICATION_PAGE_SIZE,
  NotificationListQueryDto,
} from './dto/notification-list-query.dto.js';
import {
  NotificationListResponseDto,
  NotificationResponseDto,
  UnreadCountResponseDto,
} from './dto/notification-response.dto.js';
import { NotificationsService } from './notifications.service.js';

@ApiTags('notifications')
@ApiCookieAuth('th_session')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: "Lists the signed-in user's own notifications, newest first" })
  @ApiOkResponse({ type: NotificationListResponseDto })
  async list(
    @CurrentUser() user: AuthUser,
    @Query() query: NotificationListQueryDto,
  ): Promise<NotificationListResponseDto> {
    return this.notificationsService.list(user.id, {
      unreadOnly: query.unreadOnly ?? false,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? DEFAULT_NOTIFICATION_PAGE_SIZE,
    });
  }

  @Get('unread-count')
  @ApiOperation({ summary: "The signed-in user's unread notification count" })
  @ApiOkResponse({ type: UnreadCountResponseDto })
  async unreadCount(@CurrentUser() user: AuthUser): Promise<UnreadCountResponseDto> {
    return { unreadCount: await this.notificationsService.unreadCount(user.id) };
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Marks one of the signed-in user\'s own notifications as read' })
  @ApiOkResponse({ type: NotificationResponseDto })
  async markRead(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<NotificationResponseDto> {
    return this.notificationsService.markRead(user.id, id);
  }

  @Post('read-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Marks all of the signed-in user's notifications as read" })
  async markAllRead(@CurrentUser() user: AuthUser): Promise<void> {
    await this.notificationsService.markAllRead(user.id);
  }
}
