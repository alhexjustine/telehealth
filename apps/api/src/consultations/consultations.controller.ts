import { Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthUser } from '../auth/current-user.js';
import { Role } from '../generated/prisma/enums.js';
import { ErrorResponseDto } from '../common/dto/error-response.dto.js';
import { ConsultationsService } from './consultations.service.js';
import { ConsultationSessionStateDto, ConsultationWorkspaceResponseDto } from './dto/consultation-response.dto.js';

@ApiTags('consultations')
@ApiCookieAuth('th_session')
@Controller('consultations')
export class ConsultationsController {
  constructor(private readonly consultationsService: ConsultationsService) {}

  @Get(':appointmentId')
  @Roles(Role.PATIENT, Role.DOCTOR)
  @ApiOperation({ summary: "The appointment's consultation workspace; participants only" })
  @ApiOkResponse({ type: ConsultationWorkspaceResponseDto })
  @ApiResponse({ status: 409, description: 'The appointment is not active', type: ErrorResponseDto })
  async getWorkspace(
    @CurrentUser() user: AuthUser,
    @Param('appointmentId', new ParseUUIDPipe({ version: '4' })) appointmentId: string,
  ): Promise<ConsultationWorkspaceResponseDto> {
    return this.consultationsService.getWorkspace(user, appointmentId);
  }

  @Post(':appointmentId/join')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.PATIENT, Role.DOCTOR)
  @ApiOperation({ summary: 'Joins the consultation, from 15 minutes before it starts until 30 minutes after it ends' })
  @ApiOkResponse({ type: ConsultationSessionStateDto })
  @ApiResponse({ status: 409, description: 'A business rule was violated (see the code field)', type: ErrorResponseDto })
  async join(
    @CurrentUser() user: AuthUser,
    @Param('appointmentId', new ParseUUIDPipe({ version: '4' })) appointmentId: string,
  ): Promise<ConsultationSessionStateDto> {
    return this.consultationsService.join(user, appointmentId);
  }

  @Post(':appointmentId/start')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.DOCTOR)
  @ApiOperation({ summary: 'Starts the consultation once the patient has joined; doctor only' })
  @ApiOkResponse({ type: ConsultationSessionStateDto })
  @ApiResponse({ status: 409, description: 'A business rule was violated (see the code field)', type: ErrorResponseDto })
  async start(
    @CurrentUser() user: AuthUser,
    @Param('appointmentId', new ParseUUIDPipe({ version: '4' })) appointmentId: string,
  ): Promise<ConsultationSessionStateDto> {
    return this.consultationsService.start(user, appointmentId);
  }

  @Post(':appointmentId/complete')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.DOCTOR)
  @ApiOperation({ summary: 'Completes the consultation once a patient summary is written; doctor only' })
  @ApiOkResponse({ type: ConsultationSessionStateDto })
  @ApiResponse({ status: 409, description: 'A business rule was violated (see the code field)', type: ErrorResponseDto })
  async complete(
    @CurrentUser() user: AuthUser,
    @Param('appointmentId', new ParseUUIDPipe({ version: '4' })) appointmentId: string,
  ): Promise<ConsultationSessionStateDto> {
    return this.consultationsService.complete(user, appointmentId);
  }
}
