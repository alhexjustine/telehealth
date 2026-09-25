import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { SymptomCategoryDto } from './dto/symptom-response.dto.js';

@Injectable()
export class SymptomsService {
  constructor(private readonly prisma: PrismaService) {}

  async listGroupedByCategory(): Promise<SymptomCategoryDto[]> {
    const symptoms = await this.prisma.symptom.findMany({
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    const byCategory = new Map<string, SymptomCategoryDto>();
    for (const symptom of symptoms) {
      let group = byCategory.get(symptom.category);
      if (!group) {
        group = { category: symptom.category, symptoms: [] };
        byCategory.set(symptom.category, group);
      }
      group.symptoms.push({
        id: symptom.id,
        slug: symptom.slug,
        name: symptom.name,
        category: symptom.category,
        isRedFlag: symptom.isRedFlag,
      });
    }
    return [...byCategory.values()];
  }
}
