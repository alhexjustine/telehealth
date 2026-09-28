import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { DiscoveryService } from '../discovery/discovery.service.js';
import { visibleDoctorWhere } from '../doctors/doctor-visibility.js';
import { DomainError } from '../common/errors/domain-error.js';
import { ErrorCode } from '../common/errors/error-codes.js';
import type { FavoriteResponseDto, FavoriteDoctorSummaryDto } from './dto/favorite-response.dto.js';

export const MAX_FAVORITE_DOCTORS_PER_PATIENT = 50;

@Injectable()
export class FavoritesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly discoveryService: DiscoveryService,
  ) {}

  /** Idempotent: favoriting an already-favorited doctor is a no-op, not an error. */
  async favorite(patientId: string, doctorId: string): Promise<{ dto: FavoriteResponseDto; created: boolean }> {
    const existing = await this.prisma.doctorFavorite.findUnique({
      where: { patientId_doctorId: { patientId, doctorId } },
    });
    if (existing) {
      return { dto: { doctorId, favoritedAt: existing.createdAt.toISOString() }, created: false };
    }

    const visible = await this.prisma.doctorProfile.findFirst({
      where: { AND: [visibleDoctorWhere(), { userId: doctorId }] },
      select: { userId: true },
    });
    if (!visible) {
      throw new NotFoundException('Doctor not found');
    }

    const favoriteCount = await this.prisma.doctorFavorite.count({ where: { patientId } });
    if (favoriteCount >= MAX_FAVORITE_DOCTORS_PER_PATIENT) {
      throw new DomainError(
        HttpStatus.CONFLICT,
        ErrorCode.FAVORITE_LIMIT_REACHED,
        `You can have at most ${MAX_FAVORITE_DOCTORS_PER_PATIENT} favorite doctors.`,
      );
    }

    const created = await this.prisma.doctorFavorite.create({ data: { patientId, doctorId } });
    return { dto: { doctorId, favoritedAt: created.createdAt.toISOString() }, created: true };
  }

  /** Idempotent: unfavoriting a doctor that isn't favorited is a no-op, not an error. */
  async unfavorite(patientId: string, doctorId: string): Promise<void> {
    await this.prisma.doctorFavorite.deleteMany({ where: { patientId, doctorId } });
  }

  /**
   * Entries are built live from `DiscoveryService.getSummariesForDoctors` (not
   * a stored snapshot); a doctor who is no longer visible (suspended,
   * rejected, deactivated) is silently dropped rather than erroring — see
   * design.md's "Favorites-list entries are computed live".
   */
  async list(patientId: string): Promise<FavoriteDoctorSummaryDto[]> {
    const favorites = await this.prisma.doctorFavorite.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
    });
    if (favorites.length === 0) return [];

    const summaries = await this.discoveryService.getSummariesForDoctors(
      favorites.map((favorite) => favorite.doctorId),
    );

    const result: FavoriteDoctorSummaryDto[] = [];
    for (const favorite of favorites) {
      const summary = summaries.get(favorite.doctorId);
      if (!summary) continue;
      result.push({ ...summary, favoritedAt: favorite.createdAt.toISOString() });
    }
    return result;
  }
}
