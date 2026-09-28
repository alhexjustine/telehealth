import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { ReviewsController } from './reviews.controller.js';
import { DoctorReviewsController } from './doctor-reviews.controller.js';
import { AdminReviewsController } from './admin-reviews.controller.js';
import { ReviewsService } from './reviews.service.js';
import { AdminReviewsService } from './admin-reviews.service.js';

@Module({
  imports: [AuditModule],
  controllers: [ReviewsController, DoctorReviewsController, AdminReviewsController],
  providers: [ReviewsService, AdminReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
