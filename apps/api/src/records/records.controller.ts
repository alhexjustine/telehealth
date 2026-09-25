import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthUser } from '../auth/current-user.js';
import { Role } from '../generated/prisma/enums.js';
import { RecordsService } from './records.service.js';
import { DEFAULT_RECORD_PAGE_SIZE, RecordListQueryDto } from './dto/record-query.dto.js';
import { DoctorPatientRecordResponseDto, RecordDetailResponseDto, RecordListResponseDto } from './dto/record-response.dto.js';

@ApiTags('records')
@ApiCookieAuth('th_session')
@Controller()
export class RecordsController {
  constructor(private readonly recordsService: RecordsService) {}

  @Get('records')
  @Roles(Role.PATIENT)
  @ApiOperation({ summary: "Lists the signed-in patient's completed consultations, newest first" })
  @ApiOkResponse({ type: RecordListResponseDto })
  async list(@CurrentUser() user: AuthUser, @Query() query: RecordListQueryDto): Promise<RecordListResponseDto> {
    return this.recordsService.listPatientRecords(user.id, query.page ?? 1, query.pageSize ?? DEFAULT_RECORD_PAGE_SIZE);
  }

  @Get('records/:appointmentId')
  @Roles(Role.PATIENT)
  @ApiOperation({ summary: "One of the signed-in patient's own completed consultation records" })
  @ApiOkResponse({ type: RecordDetailResponseDto })
  async detail(
    @CurrentUser() user: AuthUser,
    @Param('appointmentId', new ParseUUIDPipe({ version: '4' })) appointmentId: string,
  ): Promise<RecordDetailResponseDto> {
    return this.recordsService.getPatientRecord(user, appointmentId);
  }

  @Get('patients/:patientId/record')
  @Roles(Role.DOCTOR)
  @ApiOperation({ summary: "A patient's record, for a doctor with a booked or completed appointment with them" })
  @ApiOkResponse({ type: DoctorPatientRecordResponseDto })
  async doctorViewPatient(
    @CurrentUser() user: AuthUser,
    @Param('patientId', new ParseUUIDPipe({ version: '4' })) patientId: string,
  ): Promise<DoctorPatientRecordResponseDto> {
    return this.recordsService.getDoctorPatientRecord(user.id, patientId);
  }
}
