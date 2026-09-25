import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthUser } from '../auth/current-user.js';
import { AvailabilityService } from './availability.service.js';
import { SlotsQueryDto } from './dto/slots-query.dto.js';
import { SlotResponseDto } from './dto/slot-response.dto.js';

@ApiTags('doctor-availability')
@ApiCookieAuth('th_session')
@Controller('doctors')
export class SlotsController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Get(':doctorId/slots')
  @ApiOperation({
    summary:
      "Returns a doctor's available slots for a date range. Approved doctors are visible to " +
      'any signed-in user; a doctor who is not yet approved can only see their own slots.',
  })
  @ApiOkResponse({ type: SlotResponseDto, isArray: true })
  async getSlots(
    @CurrentUser() user: AuthUser,
    @Param('doctorId', new ParseUUIDPipe({ version: '4' })) doctorId: string,
    @Query() query: SlotsQueryDto,
  ): Promise<SlotResponseDto[]> {
    return this.availabilityService.getSlots(user, doctorId, query.from, query.to);
  }
}
