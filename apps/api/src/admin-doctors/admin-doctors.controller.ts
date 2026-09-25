import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthUser } from '../auth/current-user.js';
import { Role } from '../generated/prisma/enums.js';
import { ErrorResponseDto } from '../common/dto/error-response.dto.js';
import { UpdateDoctorProfileDto } from '../doctors/dto/update-doctor-profile.dto.js';
import { AdminDoctorsService } from './admin-doctors.service.js';
import { AdminDoctorListQueryDto } from './dto/admin-doctor-list-query.dto.js';
import { ApproveDoctorDto, RejectDoctorDto } from './dto/decide-doctor-review.dto.js';
import { AdminDoctorListResponseDto, AdminDoctorProfileDto } from './dto/admin-doctor-response.dto.js';

@ApiTags('admin-doctor-review')
@ApiCookieAuth('th_session')
@Controller('admin/doctors')
@Roles(Role.ADMIN)
export class AdminDoctorsController {
  constructor(private readonly adminDoctorsService: AdminDoctorsService) {}

  @Get()
  @ApiOperation({ summary: 'Lists doctor profiles by verification status, oldest waiting first' })
  @ApiOkResponse({ type: AdminDoctorListResponseDto })
  async list(@Query() query: AdminDoctorListQueryDto): Promise<AdminDoctorListResponseDto> {
    return this.adminDoctorsService.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: "A doctor's full profile for review, including email and license number" })
  @ApiOkResponse({ type: AdminDoctorProfileDto })
  async detail(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<AdminDoctorProfileDto> {
    return this.adminDoctorsService.detail(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: "Edits a doctor's profile; never changes verification status" })
  @ApiOkResponse({ type: AdminDoctorProfileDto })
  async update(
    @CurrentUser() admin: AuthUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateDoctorProfileDto,
  ): Promise<AdminDoctorProfileDto> {
    return this.adminDoctorsService.update(admin.id, id, dto);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approves a doctor, with an optional note' })
  @ApiOkResponse({ type: AdminDoctorProfileDto })
  @ApiResponse({ status: 409, description: 'STATUS_UNCHANGED', type: ErrorResponseDto })
  async approve(
    @CurrentUser() admin: AuthUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: ApproveDoctorDto,
  ): Promise<AdminDoctorProfileDto> {
    return this.adminDoctorsService.approve(admin.id, id, dto);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rejects a doctor, with a required note' })
  @ApiOkResponse({ type: AdminDoctorProfileDto })
  @ApiResponse({ status: 409, description: 'STATUS_UNCHANGED', type: ErrorResponseDto })
  async reject(
    @CurrentUser() admin: AuthUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: RejectDoctorDto,
  ): Promise<AdminDoctorProfileDto> {
    return this.adminDoctorsService.reject(admin.id, id, dto);
  }
}
