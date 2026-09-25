import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import type { AuthUser } from '../auth/current-user.js';
import { Role } from '../generated/prisma/enums.js';
import { MatchingService } from './matching.service.js';
import { MatchingRequestDto } from './dto/matching-request.dto.js';
import { MatchingResponseDto } from './dto/matching-response.dto.js';

@ApiTags('doctor-matching')
@ApiCookieAuth('th_session')
@Controller('matching')
@Roles(Role.PATIENT)
export class MatchingController {
  constructor(private readonly matchingService: MatchingService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Guided symptom matching: scores specializations and ranks approved doctors from ' +
      "selected symptoms and/or free text, using the patient's own profile for the age rule. " +
      'Nothing is persisted.',
  })
  @ApiOkResponse({ type: MatchingResponseDto })
  async match(
    @CurrentUser() user: AuthUser,
    @Body() dto: MatchingRequestDto,
  ): Promise<MatchingResponseDto> {
    return this.matchingService.match(user.id, dto);
  }
}
