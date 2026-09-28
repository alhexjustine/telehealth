import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service.js';
import { DEFAULT_REVIEW_PAGE_SIZE, ReviewListQueryDto } from './dto/review-list-query.dto.js';
import { DoctorReviewListResponseDto } from './dto/review-response.dto.js';

/** The public (any signed-in user), visible-only view of a doctor's reviews. */
@ApiTags('reviews')
@ApiCookieAuth('th_session')
@Controller('doctors/:doctorId/reviews')
export class DoctorReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  @ApiOperation({ summary: "Lists a doctor's visible reviews, newest first, with the aggregate rating" })
  @ApiOkResponse({ type: DoctorReviewListResponseDto })
  async list(
    @Param('doctorId', new ParseUUIDPipe({ version: '4' })) doctorId: string,
    @Query() query: ReviewListQueryDto,
  ): Promise<DoctorReviewListResponseDto> {
    return this.reviewsService.listVisibleForDoctor(doctorId, query.page ?? 1, query.pageSize ?? DEFAULT_REVIEW_PAGE_SIZE);
  }
}
