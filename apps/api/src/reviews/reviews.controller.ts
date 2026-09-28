import { Body, Controller, Get, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthUser } from '../auth/current-user.js';
import { Role } from '../generated/prisma/enums.js';
import { ErrorResponseDto } from '../common/dto/error-response.dto.js';
import { ReviewsService } from './reviews.service.js';
import { SubmitReviewDto } from './dto/submit-review.dto.js';
import { OwnReviewResponseDto } from './dto/review-response.dto.js';

/**
 * The signed-in patient's own review of one appointment (`add-doctor-reviews`).
 * Mounted under the same `appointments/:appointmentId` shape used for other
 * appointment-scoped sub-resources (`messages`, `records`' `consultations/`).
 * Allows both roles through the guard — like `ClinicalAccessPolicy`'s own
 * checks elsewhere, ownership is decided inside the service so a doctor
 * calling this on someone else's appointment gets the same 404 a stranger
 * patient would, not a role-revealing 403 (see the "Not the account's own
 * appointment" scenario, which covers both in one response code).
 */
@ApiTags('reviews')
@ApiCookieAuth('th_session')
@Controller('appointments/:appointmentId/review')
@Roles(Role.PATIENT, Role.DOCTOR)
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Put()
  @ApiOperation({ summary: 'Creates or replaces the caller\'s own rating/comment for a completed appointment' })
  @ApiOkResponse({ type: OwnReviewResponseDto })
  @ApiResponse({ status: 409, description: 'REVIEW_NOT_ELIGIBLE', type: ErrorResponseDto })
  async submit(
    @CurrentUser() user: AuthUser,
    @Param('appointmentId', new ParseUUIDPipe({ version: '4' })) appointmentId: string,
    @Body() dto: SubmitReviewDto,
  ): Promise<OwnReviewResponseDto> {
    return this.reviewsService.submitReview(user, appointmentId, dto);
  }

  @Get()
  @ApiOperation({ summary: "Returns the caller's own review of this appointment, or 404 if none" })
  @ApiOkResponse({ type: OwnReviewResponseDto })
  async getOwn(
    @CurrentUser() user: AuthUser,
    @Param('appointmentId', new ParseUUIDPipe({ version: '4' })) appointmentId: string,
  ): Promise<OwnReviewResponseDto> {
    return this.reviewsService.getOwnReview(user, appointmentId);
  }
}
