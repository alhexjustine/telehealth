import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { AuditEntityType } from '../audit/audit-entity-type.js';
import { diffFields } from '../audit/diff-fields.js';
import { DomainError } from '../common/errors/domain-error.js';
import { ErrorCode } from '../common/errors/error-codes.js';
import type { Prisma } from '../generated/prisma/client.js';
import { AuditAction } from '../generated/prisma/enums.js';
import type { AdminReviewListQueryDto } from './dto/admin-review-query.dto.js';
import type { AdminReviewDto, AdminReviewListResponseDto } from './dto/admin-review-response.dto.js';

const WITH_NAMES = {
  doctor: { select: { firstName: true, lastName: true } },
  patient: { select: { firstName: true, lastName: true } },
} satisfies Prisma.DoctorReviewInclude;

type ReviewWithNames = Prisma.DoctorReviewGetPayload<{ include: typeof WITH_NAMES }>;

@Injectable()
export class AdminReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async list(query: AdminReviewListQueryDto): Promise<AdminReviewListResponseDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.DoctorReviewWhereInput = {
      ...(query.doctorId ? { doctorId: query.doctorId } : {}),
      ...(query.hidden === undefined ? {} : query.hidden ? { hiddenAt: { not: null } } : { hiddenAt: null }),
    };

    const [items, total] = await Promise.all([
      this.prisma.doctorReview.findMany({
        where,
        include: WITH_NAMES,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.doctorReview.count({ where }),
    ]);

    return { items: items.map(toAdminReviewDto), total, page, pageSize };
  }

  async hide(adminId: string, reviewId: string, reason: string): Promise<AdminReviewDto> {
    return this.setHidden(adminId, reviewId, reason, true, AuditAction.REVIEW_HIDDEN);
  }

  async unhide(adminId: string, reviewId: string, reason: string): Promise<AdminReviewDto> {
    return this.setHidden(adminId, reviewId, reason, false, AuditAction.REVIEW_UNHIDDEN);
  }

  private async setHidden(
    adminId: string,
    reviewId: string,
    reason: string,
    hide: boolean,
    action: typeof AuditAction.REVIEW_HIDDEN | typeof AuditAction.REVIEW_UNHIDDEN,
  ): Promise<AdminReviewDto> {
    return this.prisma.$transaction(async (tx) => {
      const review = await tx.doctorReview.findUnique({ where: { id: reviewId }, include: WITH_NAMES });
      if (!review) {
        throw new NotFoundException('Review not found');
      }
      const alreadyInTargetState = hide ? review.hiddenAt !== null : review.hiddenAt === null;
      if (alreadyInTargetState) {
        throw new DomainError(
          HttpStatus.CONFLICT,
          ErrorCode.REVIEW_HIDE_STATUS_UNCHANGED,
          'The review already has this hidden status.',
        );
      }

      const before = { hiddenAt: review.hiddenAt };
      const updated = await tx.doctorReview.update({
        where: { id: reviewId },
        data: hide
          ? { hiddenAt: new Date(), hiddenById: adminId, hiddenReason: reason }
          : { hiddenAt: null, hiddenById: null, hiddenReason: null },
        include: WITH_NAMES,
      });

      const diff = diffFields(before, { hiddenAt: updated.hiddenAt }, ['hiddenAt']);
      await this.auditService.record(tx, {
        actorId: adminId,
        action,
        entityType: AuditEntityType.DOCTOR_REVIEW,
        entityId: reviewId,
        reason,
        before: diff.before,
        after: diff.after,
      });

      return toAdminReviewDto(updated);
    });
  }
}

function toAdminReviewDto(review: ReviewWithNames): AdminReviewDto {
  return {
    id: review.id,
    appointmentId: review.appointmentId,
    doctorId: review.doctorId,
    doctorDisplayName: `${review.doctor.firstName} ${review.doctor.lastName}`,
    patientId: review.patientId,
    patientDisplayName: `${review.patient.firstName} ${review.patient.lastName}`,
    rating: review.rating,
    comment: review.comment,
    hidden: review.hiddenAt !== null,
    hiddenReason: review.hiddenReason,
    createdAt: review.createdAt.toISOString(),
  };
}
