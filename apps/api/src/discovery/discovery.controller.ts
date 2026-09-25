import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthUser } from '../auth/current-user.js';
import { DiscoveryService } from './discovery.service.js';
import { SearchDoctorsQueryDto } from './dto/search-doctors-query.dto.js';
import { DoctorSearchResponseDto } from './dto/doctor-search-result.dto.js';
import { PublicDoctorProfileDto } from './dto/public-doctor-profile.dto.js';

@ApiTags('doctor-discovery')
@ApiCookieAuth('th_session')
@Controller('doctors')
export class DiscoveryController {
  constructor(private readonly discoveryService: DiscoveryService) {}

  @Get()
  @ApiOperation({ summary: 'Searches approved, active doctors with filters, sorting, and pagination' })
  @ApiOkResponse({ type: DoctorSearchResponseDto })
  async search(@Query() query: SearchDoctorsQueryDto): Promise<DoctorSearchResponseDto> {
    return this.discoveryService.search(query);
  }

  @Get(':doctorId')
  @ApiOperation({
    summary:
      "Returns a doctor's public profile. Approved, active doctors are visible to any " +
      'signed-in user; a doctor may always view their own profile.',
  })
  @ApiOkResponse({ type: PublicDoctorProfileDto })
  async getProfile(
    @CurrentUser() user: AuthUser,
    @Param('doctorId', new ParseUUIDPipe({ version: '4' })) doctorId: string,
  ): Promise<PublicDoctorProfileDto> {
    return this.discoveryService.getProfile(user.id, doctorId);
  }
}
