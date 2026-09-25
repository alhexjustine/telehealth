import { describe, expect, it } from '@jest/globals';
import { SYMPTOM_CATALOG_SEED_DATA } from './symptom-catalog-seed-data.js';

// The 13 fixed specialization slugs seeded by `add-authentication`'s
// `20260925081535_add_profiles_specializations` migration.
const ALL_SPECIALIZATION_SLUGS = [
  'general-practice',
  'internal-medicine',
  'pediatrics',
  'dermatology',
  'cardiology',
  'neurology',
  'psychiatry',
  'obstetrics-gynecology',
  'ent',
  'orthopedics',
  'gastroenterology',
  'pulmonology',
  'endocrinology',
];

const REQUIRED_RED_FLAGS = [
  'difficulty breathing',
  'severe bleeding',
  'sudden weakness or numbness on one side',
  'sudden severe headache',
  'thoughts of self-harm',
  'loss of consciousness',
  'seizure',
  'swelling of the face or throat',
];

describe('Symptom catalog seed data', () => {
  it('contains at least 40 symptoms across at least 8 categories', () => {
    expect(SYMPTOM_CATALOG_SEED_DATA.length).toBeGreaterThanOrEqual(40);
    const categories = new Set(SYMPTOM_CATALOG_SEED_DATA.map((s) => s.category));
    expect(categories.size).toBeGreaterThanOrEqual(8);
  });

  it('every specialization is reachable from at least one symptom', () => {
    const reachable = new Set(
      SYMPTOM_CATALOG_SEED_DATA.flatMap((s) => s.links.map((l) => l.specializationSlug)),
    );
    for (const slug of ALL_SPECIALIZATION_SLUGS) {
      expect(reachable.has(slug)).toBe(true);
    }
  });

  it('every weight is between 1 and 3', () => {
    for (const symptom of SYMPTOM_CATALOG_SEED_DATA) {
      expect(symptom.links.length).toBeGreaterThan(0);
      for (const link of symptom.links) {
        expect(link.weight).toBeGreaterThanOrEqual(1);
        expect(link.weight).toBeLessThanOrEqual(3);
      }
    }
  });

  it('every slug is unique', () => {
    const slugs = SYMPTOM_CATALOG_SEED_DATA.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('includes the spec-named rules with exactly their keywords and weights', () => {
    const bySlug = new Map(SYMPTOM_CATALOG_SEED_DATA.map((s) => [s.slug, s]));

    const headache = bySlug.get('headache');
    expect(headache?.keywords).toEqual(['headache', 'migraine']);
    expect(headache?.links).toEqual(
      expect.arrayContaining([
        { specializationSlug: 'neurology', weight: 3 },
        { specializationSlug: 'general-practice', weight: 1 },
      ]),
    );

    const skinRash = bySlug.get('skin-rash');
    expect(skinRash?.keywords).toEqual(['rash', 'hives', 'itchy skin']);
    expect(skinRash?.links).toEqual([{ specializationSlug: 'dermatology', weight: 3 }]);

    const cough = bySlug.get('cough');
    expect(cough?.keywords).toEqual(['cough', 'coughing']);
    expect(cough?.links).toEqual(
      expect.arrayContaining([
        { specializationSlug: 'pulmonology', weight: 2 },
        { specializationSlug: 'general-practice', weight: 2 },
      ]),
    );

    const chestPain = bySlug.get('chest-pain');
    expect(chestPain?.keywords).toEqual(['chest pain', 'chest tightness']);
    expect(chestPain?.isRedFlag).toBe(true);
    expect(chestPain?.links).toEqual([{ specializationSlug: 'cardiology', weight: 3 }]);

    const anxiety = bySlug.get('anxiety');
    expect(anxiety?.keywords).toEqual(['anxiety', 'anxious', 'panic']);
    expect(anxiety?.links).toEqual([{ specializationSlug: 'psychiatry', weight: 3 }]);
  });

  it('includes every required red flag', () => {
    const redFlagNames = SYMPTOM_CATALOG_SEED_DATA.filter((s) => s.isRedFlag).map((s) =>
      s.name.toLowerCase(),
    );
    for (const required of REQUIRED_RED_FLAGS) {
      expect(redFlagNames).toContain(required);
    }
  });
});
