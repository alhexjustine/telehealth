import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthUser } from '../auth/current-user.js';
import { Role } from '../generated/prisma/enums.js';
import { DoctorsService } from './doctors.service.js';
import { UpdateDoctorProfileDto } from './dto/update-doctor-profile.dto.js';
import { DoctorProfileResponseDto } from './dto/doctor-profile-response.dto.js';

@ApiTags('doctors')
@ApiCookieAuth('th_session')
@Controller('doctors/me/profile')
@Roles(Role.DOCTOR)
export class DoctorsController {
  constructor(private readonly doctorsService: DoctorsService) {}

  @Get()
  @ApiOperation({ summary: "Returns the signed-in doctor's own profile" })
  @ApiOkResponse({ type: DoctorProfileResponseDto })
  async getProfile(@CurrentUser() user: AuthUser): Promise<DoctorProfileResponseDto> {
    return this.doctorsService.getOwnProfile(user.id);
  }

  @Patch()
  @ApiOperation({ summary: "Updates the signed-in doctor's own profile" })
  @ApiOkResponse({ type: DoctorProfileResponseDto })
  async updateProfile(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateDoctorProfileDto,
  ): Promise<DoctorProfileResponseDto> {
    return this.doctorsService.updateOwnProfile(user.id, dto);
  }
}
