import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthUser } from '../auth/current-user.js';
import { Role } from '../generated/prisma/enums.js';
import { AvailabilityService } from './availability.service.js';
import { SaveAvailabilityDto } from './dto/save-availability.dto.js';
import { CreateTimeOffDto } from './dto/create-time-off.dto.js';
import { AvailabilityResponseDto, TimeOffResponseDto } from './dto/availability-response.dto.js';

@ApiTags('doctor-availability')
@ApiCookieAuth('th_session')
@Controller('doctors/me/availability')
@Roles(Role.DOCTOR)
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Get()
  @ApiOperation({
    summary: "Returns the signed-in doctor's time zone, weekly schedule, and upcoming time off",
  })
  @ApiOkResponse({ type: AvailabilityResponseDto })
  async getAvailability(@CurrentUser() user: AuthUser): Promise<AvailabilityResponseDto> {
    return this.availabilityService.getOwnAvailability(user.id);
  }

  @Put()
  @ApiOperation({ summary: "Replaces the signed-in doctor's time zone and weekly schedule" })
  @ApiOkResponse({ type: AvailabilityResponseDto })
  async saveAvailability(
    @CurrentUser() user: AuthUser,
    @Body() dto: SaveAvailabilityDto,
  ): Promise<AvailabilityResponseDto> {
    return this.availabilityService.saveAvailability(user.id, dto);
  }

  @Post('exceptions')
  @ApiOperation({ summary: 'Adds a time-off entry' })
  @ApiCreatedResponse({ type: TimeOffResponseDto })
  async addTimeOff(@CurrentUser() user: AuthUser, @Body() dto: CreateTimeOffDto): Promise<TimeOffResponseDto> {
    return this.availabilityService.addTimeOff(user.id, dto);
  }

  @Delete('exceptions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deletes one of the signed-in doctor\'s own time-off entries' })
  @ApiNoContentResponse()
  async deleteTimeOff(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<void> {
    await this.availabilityService.deleteTimeOff(user.id, id);
  }
}
