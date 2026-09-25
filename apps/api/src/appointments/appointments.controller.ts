import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthUser } from '../auth/current-user.js';
import { Role } from '../generated/prisma/enums.js';
import { ErrorResponseDto } from '../common/dto/error-response.dto.js';
import { AppointmentsService } from './appointments.service.js';
import { CreateAppointmentDto } from './dto/create-appointment.dto.js';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto.js';
import { CancelAppointmentDto } from './dto/cancel-appointment.dto.js';
import {
  AppointmentListQueryDto,
  DEFAULT_APPOINTMENT_PAGE_SIZE,
} from './dto/appointment-list-query.dto.js';
import {
  AppointmentDetailResponseDto,
  AppointmentListResponseDto,
  AppointmentResponseDto,
} from './dto/appointment-response.dto.js';

@ApiTags('appointments')
@ApiCookieAuth('th_session')
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Post()
  @Roles(Role.PATIENT)
  @ApiOperation({ summary: 'Books an appointment in one of a doctor’s currently available slots' })
  @ApiCreatedResponse({ type: AppointmentResponseDto })
  @ApiResponse({ status: 409, description: 'A business rule was violated (see the code field)', type: ErrorResponseDto })
  async book(@CurrentUser() user: AuthUser, @Body() dto: CreateAppointmentDto): Promise<AppointmentResponseDto> {
    return this.appointmentsService.book(user.id, dto);
  }

  @Get()
  @Roles(Role.PATIENT, Role.DOCTOR)
  @ApiOperation({ summary: "Lists the signed-in patient's or doctor's own appointments" })
  @ApiOkResponse({ type: AppointmentListResponseDto })
  async list(
    @CurrentUser() user: AuthUser,
    @Query() query: AppointmentListQueryDto,
  ): Promise<AppointmentListResponseDto> {
    return this.appointmentsService.list(
      user,
      query.scope,
      query.page ?? 1,
      query.pageSize ?? DEFAULT_APPOINTMENT_PAGE_SIZE,
    );
  }

  @Get(':id')
  @Roles(Role.PATIENT, Role.DOCTOR)
  @ApiOperation({ summary: "One appointment's details, including its reschedule/cancellation history; participants only" })
  @ApiOkResponse({ type: AppointmentDetailResponseDto })
  async detail(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<AppointmentDetailResponseDto> {
    return this.appointmentsService.detail(user, id);
  }

  @Post(':id/reschedule')
  @Roles(Role.PATIENT)
  @ApiOperation({ summary: 'Reschedules a booked appointment to another available slot with the same doctor' })
  @ApiCreatedResponse({ type: AppointmentResponseDto })
  @ApiResponse({ status: 409, description: 'A business rule was violated (see the code field)', type: ErrorResponseDto })
  async reschedule(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: RescheduleAppointmentDto,
  ): Promise<AppointmentResponseDto> {
    return this.appointmentsService.reschedule(user.id, id, dto);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.PATIENT, Role.DOCTOR)
  @ApiOperation({ summary: 'Cancels a booked appointment; the doctor must give a reason, the patient may' })
  @ApiOkResponse({ type: AppointmentResponseDto })
  @ApiResponse({ status: 409, description: 'A business rule was violated (see the code field)', type: ErrorResponseDto })
  async cancel(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: CancelAppointmentDto,
  ): Promise<AppointmentResponseDto> {
    return this.appointmentsService.cancel(user, id, dto);
  }
}
