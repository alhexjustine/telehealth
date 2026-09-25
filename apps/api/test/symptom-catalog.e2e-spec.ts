import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { createTestApp } from './support/test-app.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

/**
 * Verifies the `20260925103000_add_symptom_catalog` migration's seed data
 * directly against the database (the `GET /symptoms` endpoint, tested
 * separately, only ever exposes a subset of these fields).
 */
describe('Symptom catalog', () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('Catalog available after migration', async () => {
    const prisma = app.get(PrismaService);
    const symptoms = await prisma.symptom.findMany();
    expect(symptoms.length).toBeGreaterThanOrEqual(40);

    const categories = new Set(symptoms.map((s) => s.category));
    expect(categories.size).toBeGreaterThanOrEqual(8);

    const bySlug = new Map(symptoms.map((s) => [s.slug, s]));
    expect(bySlug.get('headache')).toMatchObject({ keywords: ['headache', 'migraine'] });
    expect(bySlug.get('skin-rash')).toMatchObject({ keywords: ['rash', 'hives', 'itchy skin'] });
    expect(bySlug.get('cough')).toMatchObject({ keywords: ['cough', 'coughing'] });
    expect(bySlug.get('chest-pain')).toMatchObject({
      keywords: ['chest pain', 'chest tightness'],
      isRedFlag: true,
    });
    expect(bySlug.get('anxiety')).toMatchObject({ keywords: ['anxiety', 'anxious', 'panic'] });

    const redFlagNames = symptoms.filter((s) => s.isRedFlag).map((s) => s.name.toLowerCase());
    for (const required of [
      'difficulty breathing',
      'severe bleeding',
      'sudden weakness or numbness on one side',
      'sudden severe headache',
      'thoughts of self-harm',
      'loss of consciousness',
      'seizure',
      'swelling of the face or throat',
    ]) {
      expect(redFlagNames).toContain(required);
    }

    const chestPain = bySlug.get('chest-pain');
    const links = await prisma.symptomSpecialization.findMany({
      where: { symptomId: chestPain!.id },
      include: { specialization: true },
    });
    expect(links).toHaveLength(1);
    expect(links[0]?.specialization.slug).toBe('cardiology');
    expect(links[0]?.weight).toBe(3);
  });
});
