import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Specialization } from '../generated/prisma/client.js';

@Injectable()
export class SpecializationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<Specialization[]> {
    return this.prisma.specialization.findMany({ orderBy: { name: 'asc' } });
  }

  async findManyByIds(ids: string[]): Promise<Specialization[]> {
    if (ids.length === 0) {
      return [];
    }
    return this.prisma.specialization.findMany({ where: { id: { in: ids } } });
  }

  /** True only when every given ID exists in the catalog. */
  async areAllValid(ids: string[]): Promise<boolean> {
    const found = await this.findManyByIds(ids);
    return found.length === new Set(ids).size;
  }
}
