import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { NextSlotService, type DoctorSlotInput } from '../availability/next-slot.service.js';
import type { Slot } from '../availability/slot-generator.js';
import { visibleDoctorWhere, isVisibleDoctor } from '../doctors/doctor-visibility.js';
import { ReviewsService } from '../reviews/reviews.service.js';
import { NO_REVIEWS, type ReviewAggregate } from '../reviews/review-aggregate.js';
import type { Prisma } from '../generated/prisma/client.js';
import {
  DEFAULT_PAGE_SIZE,
  type DoctorSortOption,
  type SearchDoctorsQueryDto,
} from './dto/search-doctors-query.dto.js';
import type { DoctorSearchResponseDto, DoctorSearchResultDto } from './dto/doctor-search-result.dto.js';
import type { PublicDoctorProfileDto } from './dto/public-doctor-profile.dto.js';

const BIO_EXCERPT_LENGTH = 200;
const SEARCH_HORIZON_DAYS = 14;
const MAX_AVAILABILITY_RANGE_MS = SEARCH_HORIZON_DAYS * 24 * 60 * 60 * 1000;

const WITH_SPECIALIZATIONS = {
  specializations: { include: { specialization: true } },
} satisfies Prisma.DoctorProfileInclude;

type DoctorWithSpecializations = Prisma.DoctorProfileGetPayload<{ include: typeof WITH_SPECIALIZATIONS }>;

@Injectable()
export class DiscoveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly nextSlotService: NextSlotService,
    private readonly reviewsService: ReviewsService,
  ) {}

  async search(query: SearchDoctorsQueryDto): Promise<DoctorSearchResponseDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const sort: DoctorSortOption = query.sort ?? 'next';

    const specializationId = await this.resolveSpecializationId(query.specialization);
    const availabilityRange = parseAvailabilityRange(query.availableFrom, query.availableTo);

    const where: Prisma.DoctorProfileWhereInput = {
      AND: [
        visibleDoctorWhere(),
        specializationId ? { specializations: { some: { specializationId } } } : {},
        query.q ? textQueryWhere(query.q) : {},
      ],
    };

    const profiles = await this.prisma.doctorProfile.findMany({
      where,
      include: WITH_SPECIALIZATIONS,
    });

    const now = new Date();
    const horizonTo = new Date(now.getTime() + SEARCH_HORIZON_DAYS * 24 * 60 * 60 * 1000);
    const slotsByDoctor = await this.nextSlotService.slotsFor(
      profiles.map(toSlotInput),
      now,
      horizonTo,
      now,
    );

    // A doctor who has paused new bookings has no bookable time at all, regardless of their
    // configured weekly hours — treated as slot-less here so they still appear in an unfiltered
    // search (with no next-available time) but never match an availability-range filter.
    let candidates = profiles.map((profile) => ({
      profile,
      slots: profile.acceptingBookings ? (slotsByDoctor.get(profile.userId) ?? []) : [],
    }));

    if (availabilityRange) {
      const { from, to } = availabilityRange;
      candidates = candidates.filter((candidate) =>
        candidate.slots.some((slot) => slot.start >= from && slot.start < to),
      );
    }

    const aggregates = await this.reviewsService.getAggregatesForDoctors(candidates.map((c) => c.profile.userId));
    candidates.sort(comparatorFor(sort, aggregates));

    const total = candidates.length;
    const start = (page - 1) * pageSize;
    const pageItems = candidates.slice(start, start + pageSize);

    return {
      items: pageItems.map((candidate) =>
        toSearchResultDto(
          candidate.profile,
          candidate.slots,
          aggregates.get(candidate.profile.userId) ?? NO_REVIEWS,
          availabilityRange,
        ),
      ),
      total,
      page,
      pageSize,
    };
  }

  async getProfile(callerId: string, doctorId: string): Promise<PublicDoctorProfileDto> {
    const profile = await this.prisma.doctorProfile.findUnique({
      where: { userId: doctorId },
      include: { ...WITH_SPECIALIZATIONS, user: { select: { status: true } } },
    });

    const visible =
      profile &&
      isVisibleDoctor({
        doctorId,
        verificationStatus: profile.verificationStatus,
        accountStatus: profile.user.status,
        callerId,
      });
    if (!visible || !profile) {
      throw new NotFoundException('Doctor not found');
    }

    const aggregate = await this.reviewsService.getAggregateForDoctor(doctorId);

    return {
      id: profile.userId,
      displayName: `${profile.firstName} ${profile.lastName}`,
      bio: profile.bio,
      specializations: profile.specializations.map((link) => ({
        id: link.specialization.id,
        slug: link.specialization.slug,
        name: link.specialization.name,
        description: link.specialization.description,
      })),
      yearsOfExperience: profile.yearsOfExperience,
      consultationMinutes: profile.consultationMinutes,
      timezone: profile.timezone,
      acceptingBookings: profile.acceptingBookings,
      averageRating: aggregate.averageRating,
      reviewCount: aggregate.reviewCount,
    };
  }

  private async resolveSpecializationId(slug?: string): Promise<string | undefined> {
    if (!slug) return undefined;
    const specialization = await this.prisma.specialization.findUnique({ where: { slug } });
    if (!specialization) {
      throw new BadRequestException('Unknown specialization');
    }
    return specialization.id;
  }
}

function textQueryWhere(q: string): Prisma.DoctorProfileWhereInput {
  return {
    OR: [
      { firstName: { contains: q, mode: 'insensitive' } },
      { lastName: { contains: q, mode: 'insensitive' } },
      { specializations: { some: { specialization: { name: { contains: q, mode: 'insensitive' } } } } },
    ],
  };
}

function parseAvailabilityRange(
  fromRaw?: string,
  toRaw?: string,
): { from: Date; to: Date } | undefined {
  if (!fromRaw && !toRaw) return undefined;
  if (!fromRaw || !toRaw) {
    throw new BadRequestException('availableFrom and availableTo must be provided together');
  }
  const from = new Date(fromRaw);
  const to = new Date(toRaw);
  if (to.getTime() <= from.getTime()) {
    throw new BadRequestException('availableTo must be after availableFrom');
  }
  if (to.getTime() - from.getTime() > MAX_AVAILABILITY_RANGE_MS) {
    throw new BadRequestException(`Availability range cannot be longer than ${SEARCH_HORIZON_DAYS} days`);
  }
  return { from, to };
}

function toSlotInput(profile: DoctorWithSpecializations): DoctorSlotInput {
  return {
    userId: profile.userId,
    timezone: profile.timezone,
    consultationMinutes: profile.consultationMinutes,
  };
}

function toSearchResultDto(
  profile: DoctorWithSpecializations,
  slots: Slot[],
  aggregate: ReviewAggregate,
  availabilityRange?: { from: Date; to: Date },
): DoctorSearchResultDto {
  // When the patient picked an availability range, show the doctor's next slot inside that range
  // (every listed candidate has at least one, per the filter above) rather than their overall next
  // slot, which can fall outside — and before — the range the patient asked for.
  const relevantSlots = availabilityRange
    ? slots.filter((slot) => slot.start >= availabilityRange.from && slot.start < availabilityRange.to)
    : slots;
  return {
    id: profile.userId,
    displayName: `${profile.firstName} ${profile.lastName}`,
    specializations: profile.specializations.map((link) => ({
      id: link.specialization.id,
      name: link.specialization.name,
    })),
    bioExcerpt: excerpt(profile.bio, BIO_EXCERPT_LENGTH),
    yearsOfExperience: profile.yearsOfExperience,
    consultationMinutes: profile.consultationMinutes,
    acceptingBookings: profile.acceptingBookings,
    nextAvailableSlot: relevantSlots[0] ? relevantSlots[0].start.toISOString() : null,
    averageRating: aggregate.averageRating,
    reviewCount: aggregate.reviewCount,
  };
}

function excerpt(text: string | null, maxLength: number): string | null {
  if (text === null) return null;
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

function displayName(profile: { firstName: string; lastName: string }): string {
  return `${profile.firstName} ${profile.lastName}`;
}

function comparatorFor(
  sort: DoctorSortOption,
  aggregates: Map<string, ReviewAggregate>,
): (a: { profile: DoctorWithSpecializations; slots: Slot[] }, b: { profile: DoctorWithSpecializations; slots: Slot[] }) => number {
  switch (sort) {
    case 'name':
      return (a, b) => displayName(a.profile).localeCompare(displayName(b.profile));
    case 'experience':
      return (a, b) => {
        const experienceDiff = (b.profile.yearsOfExperience ?? -1) - (a.profile.yearsOfExperience ?? -1);
        return experienceDiff !== 0 ? experienceDiff : displayName(a.profile).localeCompare(displayName(b.profile));
      };
    case 'rating':
      // Opt-in only (design.md: "never blended into the default sort or into
      // specialty matching") — highest average first, doctors with no
      // reviews last, ties broken by display name.
      return (a, b) => {
        const aRating = aggregates.get(a.profile.userId)?.averageRating ?? Number.NEGATIVE_INFINITY;
        const bRating = aggregates.get(b.profile.userId)?.averageRating ?? Number.NEGATIVE_INFINITY;
        return bRating !== aRating ? bRating - aRating : displayName(a.profile).localeCompare(displayName(b.profile));
      };
    case 'next':
    default:
      return (a, b) => {
        const aNext = a.slots[0]?.start.getTime() ?? Number.POSITIVE_INFINITY;
        const bNext = b.slots[0]?.start.getTime() ?? Number.POSITIVE_INFINITY;
        return aNext !== bNext ? aNext - bNext : displayName(a.profile).localeCompare(displayName(b.profile));
      };
  }
}
