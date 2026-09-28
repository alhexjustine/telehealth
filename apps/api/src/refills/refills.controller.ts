import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthUser } from '../auth/current-user.js';
import { Role } from '../generated/prisma/enums.js';
import { ErrorResponseDto } from '../common/dto/error-response.dto.js';
import { RefillsService } from './refills.service.js';
import { RequestRefillDto } from './dto/request-refill.dto.js';
import { DecideRefillDto } from './dto/decide-refill.dto.js';
import { RefillRequestListQueryDto, DEFAULT_REFILL_REQUEST_PAGE_SIZE } from './dto/refill-request-list-query.dto.js';
import { RefillRequestListResponseDto, RefillRequestResponseDto } from './dto/refill-request-response.dto.js';

/**
 * A patient requesting a refill of a prescription from one of their own (or
 * a dependent's) completed consultation records (`add-prescription-refills`).
 * Mounted under the same `records/:appointmentId` shape `RecordsController`
 * already uses for that appointment's record.
 */
@ApiTags('refills')
@ApiCookieAuth('th_session')
@Controller('records/:appointmentId/prescriptions/:prescriptionId/refill-requests')
@Roles(Role.PATIENT)
export class RefillsController {
  constructor(private readonly refillsService: RefillsService) {}

  @Post()
  @ApiOperation({ summary: 'Requests a refill of a prescription from one of the caller\'s own completed consultation records' })
  @ApiCreatedResponse({ type: RefillRequestResponseDto })
  @ApiResponse({ status: 409, description: 'REFILL_REQUEST_ALREADY_PENDING', type: ErrorResponseDto })
  async request(
    @CurrentUser() user: AuthUser,
    @Param('appointmentId', new ParseUUIDPipe({ version: '4' })) appointmentId: string,
    @Param('prescriptionId', new ParseUUIDPipe({ version: '4' })) prescriptionId: string,
    @Body() dto: RequestRefillDto,
  ): Promise<RefillRequestResponseDto> {
    return this.refillsService.request(user, appointmentId, prescriptionId, dto);
  }
}

/**
 * The treating doctor's refill-request queue and approve/deny actions
 * (`add-prescription-refills`), mounted under the same self-scoped
 * `doctors/me/...` shape as `doctors/me/availability`.
 */
@ApiTags('refills')
@ApiCookieAuth('th_session')
@Controller('doctors/me/refill-requests')
@Roles(Role.DOCTOR)
export class DoctorRefillsController {
  constructor(private readonly refillsService: RefillsService) {}

  @Get()
  @ApiOperation({ summary: "Lists the signed-in doctor's own refill requests, optionally filtered by status" })
  @ApiOkResponse({ type: RefillRequestListResponseDto })
  async list(
    @CurrentUser() user: AuthUser,
    @Query() query: RefillRequestListQueryDto,
  ): Promise<RefillRequestListResponseDto> {
    return this.refillsService.listForDoctor(
      user.id,
      query.status,
      query.page ?? 1,
      query.pageSize ?? DEFAULT_REFILL_REQUEST_PAGE_SIZE,
    );
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approves a pending refill request' })
  @ApiOkResponse({ type: RefillRequestResponseDto })
  @ApiResponse({ status: 409, description: 'REFILL_REQUEST_NOT_PENDING', type: ErrorResponseDto })
  async approve(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: DecideRefillDto,
  ): Promise<RefillRequestResponseDto> {
    return this.refillsService.approve(user.id, id, dto);
  }

  @Post(':id/deny')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Denies a pending refill request' })
  @ApiOkResponse({ type: RefillRequestResponseDto })
  @ApiResponse({ status: 409, description: 'REFILL_REQUEST_NOT_PENDING', type: ErrorResponseDto })
  async deny(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: DecideRefillDto,
  ): Promise<RefillRequestResponseDto> {
    return this.refillsService.deny(user.id, id, dto);
  }
}
