import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthUser } from '../auth/current-user.js';
import { Role } from '../generated/prisma/enums.js';
import { ErrorResponseDto } from '../common/dto/error-response.dto.js';
import { RateLimit } from '../common/rate-limit/rate-limit.decorator.js';
import { RateLimitGuard } from '../common/rate-limit/rate-limit.guard.js';
import { MessagesService } from './messages.service.js';
import { SendMessageDto } from './dto/send-message.dto.js';
import { DEFAULT_MESSAGE_PAGE_SIZE, MessageListQueryDto } from './dto/message-list-query.dto.js';
import { MessageListResponseDto, MessageResponseDto } from './dto/message-response.dto.js';

/**
 * A message thread scoped to one appointment (see `add-consultation-messaging`).
 * Mounted under the same `appointments/:appointmentId` shape used elsewhere
 * for appointment-scoped sub-resources (`records`'
 * `consultations/:appointmentId`). Both routes are participant-only;
 * `MessageAccessPolicy` gates the send/read windows.
 */
@ApiTags('messages')
@ApiCookieAuth('th_session')
@Controller('appointments/:appointmentId/messages')
@Roles(Role.PATIENT, Role.DOCTOR)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post()
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 20, windowMs: 60_000 })
  @ApiOperation({ summary: 'Sends a message on a BOOKED appointment; participants only' })
  @ApiCreatedResponse({ type: MessageResponseDto })
  @ApiResponse({ status: 409, description: 'The appointment is not active', type: ErrorResponseDto })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded', type: ErrorResponseDto })
  async send(
    @CurrentUser() user: AuthUser,
    @Param('appointmentId', new ParseUUIDPipe({ version: '4' })) appointmentId: string,
    @Body() dto: SendMessageDto,
  ): Promise<MessageResponseDto> {
    return this.messagesService.send(user, appointmentId, dto.body);
  }

  @Get()
  @ApiOperation({ summary: "The appointment's message thread, oldest first; participants only while BOOKED or COMPLETED" })
  @ApiOkResponse({ type: MessageListResponseDto })
  async list(
    @CurrentUser() user: AuthUser,
    @Param('appointmentId', new ParseUUIDPipe({ version: '4' })) appointmentId: string,
    @Query() query: MessageListQueryDto,
  ): Promise<MessageListResponseDto> {
    return this.messagesService.list(user, appointmentId, query.page ?? 1, query.pageSize ?? DEFAULT_MESSAGE_PAGE_SIZE);
  }
}
