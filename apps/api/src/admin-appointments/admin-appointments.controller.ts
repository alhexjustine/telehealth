import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthUser } from '../auth/current-user.js';
import { Role } from '../generated/prisma/enums.js';
import { ErrorResponseDto } from '../common/dto/error-response.dto.js';
import { AdminAppointmentsService } from './admin-appointments.service.js';
import { AdminAppointmentListQueryDto } from './dto/admin-appointment-list-query.dto.js';
import { AdminCancelAppointmentDto } from './dto/admin-cancel-appointment.dto.js';
import { MarkNotHeldDto } from './dto/mark-not-held.dto.js';
import { AdminAppointmentListResponseDto, AdminAppointmentResponseDto } from './dto/admin-appointment-response.dto.js';

@ApiTags('admin-appointments')
@ApiCookieAuth('th_session')
@Controller('admin/appointments')
@Roles(Role.ADMIN)
export class AdminAppointmentsController {
  constructor(private readonly adminAppointmentsService: AdminAppointmentsService) {}

  @Get()
  @ApiOperation({ summary: 'Lists every appointment with filters; never includes clinical content' })
  @ApiOkResponse({ type: AdminAppointmentListResponseDto })
  async list(@Query() query: AdminAppointmentListQueryDto): Promise<AdminAppointmentListResponseDto> {
    return this.adminAppointmentsService.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: "One appointment's oversight details; never includes clinical content" })
  @ApiOkResponse({ type: AdminAppointmentResponseDto })
  async detail(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<AdminAppointmentResponseDto> {
    return this.adminAppointmentsService.detail(id);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancels a BOOKED appointment that has not ended, with a required reason' })
  @ApiOkResponse({ type: AdminAppointmentResponseDto })
  @ApiResponse({ status: 409, description: 'APPOINTMENT_NOT_CANCELLABLE', type: ErrorResponseDto })
  async cancel(
    @CurrentUser() admin: AuthUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: AdminCancelAppointmentDto,
  ): Promise<AdminAppointmentResponseDto> {
    return this.adminAppointmentsService.cancel(admin.id, id, dto);
  }

  @Post(':id/mark-not-held')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Marks a stale, uncompleted appointment NOT_HELD, with a required reason' })
  @ApiOkResponse({ type: AdminAppointmentResponseDto })
  @ApiResponse({ status: 409, description: 'NOT_ELIGIBLE_FOR_NOT_HELD', type: ErrorResponseDto })
  async markNotHeld(
    @CurrentUser() admin: AuthUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: MarkNotHeldDto,
  ): Promise<AdminAppointmentResponseDto> {
    return this.adminAppointmentsService.markNotHeld(admin.id, id, dto);
  }
}
