import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ApiCookieAuth, ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthUser } from '../auth/current-user.js';
import { Role } from '../generated/prisma/enums.js';
import { ErrorResponseDto } from '../common/dto/error-response.dto.js';
import { ConsultationNoteDto, PrescriptionResponseDto } from '../consultations/dto/consultation-response.dto.js';
import { RecordsService } from './records.service.js';
import { SaveConsultationNoteDto } from './dto/save-consultation-note.dto.js';
import { CreatePrescriptionDto, UpdatePrescriptionDto } from './dto/prescription.dto.js';

/**
 * Doctor-only writes to one appointment's clinical record, mounted under the
 * same `consultations/:appointmentId` path as `ConsultationsController` (see
 * design.md's API surface table). Every route goes through
 * `ClinicalAccessPolicy.assertCanWriteRecord` inside `RecordsService`.
 */
@ApiTags('records')
@ApiCookieAuth('th_session')
@Controller('consultations/:appointmentId')
@Roles(Role.DOCTOR)
export class ConsultationRecordsController {
  constructor(private readonly recordsService: RecordsService) {}

  @Put('note')
  @ApiOperation({ summary: "Replaces the consultation's note; doctor only, while the session is JOINED or IN_PROGRESS" })
  @ApiOkResponse({ type: ConsultationNoteDto })
  @ApiResponse({ status: 409, description: 'A business rule was violated (see the code field)', type: ErrorResponseDto })
  async saveNote(
    @CurrentUser() user: AuthUser,
    @Param('appointmentId', new ParseUUIDPipe({ version: '4' })) appointmentId: string,
    @Body() dto: SaveConsultationNoteDto,
  ): Promise<ConsultationNoteDto> {
    return this.recordsService.saveNote(user, appointmentId, dto);
  }

  @Post('prescriptions')
  @ApiOperation({ summary: 'Adds a prescription to the consultation; doctor only' })
  @ApiCreatedResponse({ type: PrescriptionResponseDto })
  @ApiResponse({ status: 409, description: 'A business rule was violated (see the code field)', type: ErrorResponseDto })
  async addPrescription(
    @CurrentUser() user: AuthUser,
    @Param('appointmentId', new ParseUUIDPipe({ version: '4' })) appointmentId: string,
    @Body() dto: CreatePrescriptionDto,
  ): Promise<PrescriptionResponseDto> {
    return this.recordsService.addPrescription(user, appointmentId, dto);
  }

  @Patch('prescriptions/:prescriptionId')
  @ApiOperation({ summary: 'Updates one field or more of a prescription; doctor only' })
  @ApiOkResponse({ type: PrescriptionResponseDto })
  @ApiResponse({ status: 409, description: 'A business rule was violated (see the code field)', type: ErrorResponseDto })
  async updatePrescription(
    @CurrentUser() user: AuthUser,
    @Param('appointmentId', new ParseUUIDPipe({ version: '4' })) appointmentId: string,
    @Param('prescriptionId', new ParseUUIDPipe({ version: '4' })) prescriptionId: string,
    @Body() dto: UpdatePrescriptionDto,
  ): Promise<PrescriptionResponseDto> {
    return this.recordsService.updatePrescription(user, appointmentId, prescriptionId, dto);
  }

  @Delete('prescriptions/:prescriptionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Removes a prescription; doctor only' })
  @ApiNoContentResponse()
  @ApiResponse({ status: 409, description: 'A business rule was violated (see the code field)', type: ErrorResponseDto })
  async deletePrescription(
    @CurrentUser() user: AuthUser,
    @Param('appointmentId', new ParseUUIDPipe({ version: '4' })) appointmentId: string,
    @Param('prescriptionId', new ParseUUIDPipe({ version: '4' })) prescriptionId: string,
  ): Promise<void> {
    await this.recordsService.deletePrescription(user, appointmentId, prescriptionId);
  }
}
