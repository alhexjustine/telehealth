import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthUser } from '../auth/current-user.js';
import { Role } from '../generated/prisma/enums.js';
import { PatientsService } from './patients.service.js';
import { UpdatePatientProfileDto } from './dto/update-patient-profile.dto.js';
import { PatientProfileResponseDto } from './dto/patient-profile-response.dto.js';

@ApiTags('patients')
@ApiCookieAuth('th_session')
@Controller('patients/me/profile')
@Roles(Role.PATIENT)
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Get()
  @ApiOperation({ summary: "Returns the signed-in patient's own profile" })
  @ApiOkResponse({ type: PatientProfileResponseDto })
  async getProfile(@CurrentUser() user: AuthUser): Promise<PatientProfileResponseDto> {
    return this.patientsService.getOwnProfile(user.id);
  }

  @Patch()
  @ApiOperation({ summary: "Updates the signed-in patient's own profile" })
  @ApiOkResponse({ type: PatientProfileResponseDto })
  async updateProfile(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdatePatientProfileDto,
  ): Promise<PatientProfileResponseDto> {
    return this.patientsService.updateOwnProfile(user.id, dto);
  }
}
