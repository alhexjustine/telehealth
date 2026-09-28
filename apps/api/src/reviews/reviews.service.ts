import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AppointmentStatus, Role } from '../generated/prisma/enums.js';
import { DomainError } from '../common/errors/domain-error.js';
import { ErrorCode } from '../common/errors/error-codes.js';
import type { ClinicalActor } from '../consultations/clinical-access-policy.js';
import type { SubmitReviewDto } from './dto/submit-review.dto.js';
import type { DoctorReviewListResponseDto, OwnReviewResponseDto, PublicReviewDto } from './dto/review-response.dto.js';
import { NO_REVIEWS, roundToOneDecimal, type ReviewAggregate } from './review-aggregate.js';

interface AppointmentParticipantsRow {
  patientId: string;
  doctorId: string;
  status: AppointmentStatus;
}

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async submitReview(
    actor: ClinicalActor,
    appointmentId: string,
    dto: SubmitReviewDto,
  ): Promise<OwnReviewResponseDto> {
    const appointment = await this.loadAppointmentParticipants(appointmentId);
    assertOwnAppointment(actor, appointment);
    assertCompleted(appointment);

    const comment = dto.comment?.trim() || null;
    const review = await this.prisma.doctorReview.upsert({
      where: { appointmentId },
      create: {
        appointmentId,
        doctorId: appointment.doctorId,
        patientId: appointment.patientId,
        rating: dto.rating,
        comment,
      },
      update: { rating: dto.rating, comment },
    });

    return toOwnReviewDto(review);
  }

  async getOwnReview(actor: ClinicalActor, appointmentId: string): Promise<OwnReviewResponseDto> {
    const appointment = await this.loadAppointmentParticipants(appointmentId);
    assertOwnAppointment(actor, appointment);

    const review = await this.prisma.doctorReview.findUnique({ where: { appointmentId } });
    if (!review) {
      throw new NotFoundException('Review not found');
    }
    return toOwnReviewDto(review);
  }

  async listVisibleForDoctor(
    doctorId: string,
    page: number,
    pageSize: number,
  ): Promise<DoctorReviewListResponseDto> {
    const where = { doctorId, hiddenAt: null };
    const [items, aggregate] = await Promise.all([
      this.prisma.doctorReview.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.doctorReview.aggregate({ where, _avg: { rating: true }, _count: { _all: true } }),
    ]);

    const reviewCount = aggregate._count._all;
    return {
      items: items.map(toPublicReviewDto),
      total: reviewCount,
      page,
      pageSize,
      averageRating: reviewCount > 0 ? roundToOneDecimal(aggregate._avg.rating ?? 0) : null,
      reviewCount,
    };
  }

  /** Visible-only aggregate for one doctor — used by the profile endpoint. */
  async getAggregateForDoctor(doctorId: string): Promise<ReviewAggregate> {
    const aggregates = await this.getAggregatesForDoctors([doctorId]);
    return aggregates.get(doctorId) ?? NO_REVIEWS;
  }

  /**
   * Visible-only aggregates for several doctors in one query — used by
   * search results, so listing a page of doctors doesn't run one aggregate
   * query per row (see design.md's "Risks/Trade-offs": the same
   * `GROUP BY doctorId` shape already used for next-available-slot).
   */
  async getAggregatesForDoctors(doctorIds: string[]): Promise<Map<string, ReviewAggregate>> {
    if (doctorIds.length === 0) return new Map();

    const grouped = await this.prisma.doctorReview.groupBy({
      by: ['doctorId'],
      where: { doctorId: { in: doctorIds }, hiddenAt: null },
      _avg: { rating: true },
      _count: { _all: true },
    });

    const map = new Map<string, ReviewAggregate>();
    for (const row of grouped) {
      map.set(row.doctorId, {
        averageRating: roundToOneDecimal(row._avg.rating ?? 0),
        reviewCount: row._count._all,
      });
    }
    return map;
  }

  private async loadAppointmentParticipants(appointmentId: string): Promise<AppointmentParticipantsRow> {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: { patientId: true, doctorId: true, status: true },
    });
    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }
    return appointment;
  }
}

/**
 * The same ownership question `ClinicalAccessPolicy.assertCanPatientReadRecord`
 * answers, split from its completion check: a review needs "own appointment"
 * (404) and "completed" (409 `REVIEW_NOT_ELIGIBLE`) to produce two different
 * status codes, where the record-read policy collapses both into one 404
 * (see design.md's "Eligibility reuses assertCanPatientReadRecord's
 * predicate, not hasTreatingRelationship").
 */
function assertOwnAppointment(actor: ClinicalActor, appointment: AppointmentParticipantsRow): void {
  const isOwn = actor.role === Role.PATIENT && actor.id === appointment.patientId;
  if (!isOwn) {
    throw new NotFoundException('Appointment not found');
  }
}

function assertCompleted(appointment: AppointmentParticipantsRow): void {
  if (appointment.status !== AppointmentStatus.COMPLETED) {
    throw new DomainError(
      HttpStatus.CONFLICT,
      ErrorCode.REVIEW_NOT_ELIGIBLE,
      'This appointment is not yet completed.',
    );
  }
}

function toOwnReviewDto(review: { appointmentId: string; rating: number; comment: string | null; updatedAt: Date }): OwnReviewResponseDto {
  return {
    appointmentId: review.appointmentId,
    rating: review.rating,
    comment: review.comment,
    updatedAt: review.updatedAt.toISOString(),
  };
}

function toPublicReviewDto(review: { id: string; rating: number; comment: string | null; createdAt: Date }): PublicReviewDto {
  return {
    id: review.id,
    rating: review.rating,
    comment: review.comment,
    createdAt: review.createdAt.toISOString(),
  };
}
