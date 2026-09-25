import { describe, expect, it } from '@jest/globals';
import { match, normalizeText, type MatchingCatalog, type MatchingDoctor } from './matching-engine.js';

// A fixture mirroring the migration's rows for the five spec-named symptoms
// (plus "Difficulty breathing" for the "red flag described" scenario), per
// design.md's testing approach.
const GENERAL_PRACTICE = { specializationId: 'gp', specializationName: 'General Practice' };
const PEDIATRICS = { specializationId: 'peds', specializationName: 'Pediatrics' };
const NEUROLOGY = { specializationId: 'neuro', specializationName: 'Neurology' };
const DERMATOLOGY = { specializationId: 'derm', specializationName: 'Dermatology' };
const PULMONOLOGY = { specializationId: 'pulm', specializationName: 'Pulmonology' };
const CARDIOLOGY = { specializationId: 'cardio', specializationName: 'Cardiology' };
const PSYCHIATRY = { specializationId: 'psych', specializationName: 'Psychiatry' };

const CATALOG: MatchingCatalog = {
  generalPractice: GENERAL_PRACTICE,
  pediatrics: PEDIATRICS,
  symptoms: [
    {
      id: 'headache',
      name: 'Headache',
      isRedFlag: false,
      keywords: ['headache', 'migraine'],
      links: [
        { specializationId: NEUROLOGY.specializationId, specializationName: NEUROLOGY.specializationName, weight: 3 },
        { specializationId: GENERAL_PRACTICE.specializationId, specializationName: GENERAL_PRACTICE.specializationName, weight: 1 },
      ],
    },
    {
      id: 'skin-rash',
      name: 'Skin rash',
      isRedFlag: false,
      keywords: ['rash', 'hives', 'itchy skin'],
      links: [{ specializationId: DERMATOLOGY.specializationId, specializationName: DERMATOLOGY.specializationName, weight: 3 }],
    },
    {
      id: 'cough',
      name: 'Cough',
      isRedFlag: false,
      keywords: ['cough', 'coughing'],
      links: [
        { specializationId: PULMONOLOGY.specializationId, specializationName: PULMONOLOGY.specializationName, weight: 2 },
        { specializationId: GENERAL_PRACTICE.specializationId, specializationName: GENERAL_PRACTICE.specializationName, weight: 2 },
      ],
    },
    {
      id: 'chest-pain',
      name: 'Chest pain',
      isRedFlag: true,
      keywords: ['chest pain', 'chest tightness'],
      links: [{ specializationId: CARDIOLOGY.specializationId, specializationName: CARDIOLOGY.specializationName, weight: 3 }],
    },
    {
      id: 'anxiety',
      name: 'Anxiety',
      isRedFlag: false,
      keywords: ['anxiety', 'anxious', 'panic'],
      links: [{ specializationId: PSYCHIATRY.specializationId, specializationName: PSYCHIATRY.specializationName, weight: 3 }],
    },
    {
      id: 'difficulty-breathing',
      name: 'Difficulty breathing',
      isRedFlag: true,
      keywords: ['difficulty breathing', 'cant breathe', 'struggling to breathe'],
      links: [
        { specializationId: PULMONOLOGY.specializationId, specializationName: PULMONOLOGY.specializationName, weight: 3 },
        { specializationId: CARDIOLOGY.specializationId, specializationName: CARDIOLOGY.specializationName, weight: 2 },
      ],
    },
  ],
};

function doctor(id: string, displayName: string, specializationIds: string[], nextAvailableSlot: Date | null = null): MatchingDoctor {
  return { id, displayName, specializationIds, nextAvailableSlot };
}

describe('normalizeText', () => {
  it('lowercases, strips punctuation to spaces, and collapses whitespace', () => {
    expect(normalizeText("I've had a Bad Migraine!!  Since  yesterday.")).toBe(
      'i ve had a bad migraine since yesterday',
    );
  });

  it('matches a multi-word keyword phrase', () => {
    const result = match({
      symptomIds: [],
      descriptionText: 'I have chest pain today',
      catalog: CATALOG,
      patientAge: 30,
      doctors: [],
    });
    expect(result.matchedSymptoms).toEqual([{ symptomId: 'chest-pain', symptomName: 'Chest pain', source: 'described' }]);
  });

  it('does not match a keyword as a substring of a longer word', () => {
    const result = match({
      symptomIds: [],
      descriptionText: 'I have a rashguard for surfing', // contains "rash" but not as a whole word
      catalog: CATALOG,
      patientAge: 30,
      doctors: [],
    });
    expect(result.matchedSymptoms).toEqual([]);
  });
});

describe('match', () => {
  it('Selected symptom', () => {
    const derm = doctor('doc-derm', 'Dr. Derma', [DERMATOLOGY.specializationId]);
    const result = match({
      symptomIds: ['skin-rash'],
      catalog: CATALOG,
      patientAge: 30,
      doctors: [derm],
    });

    expect(result.specializations[0]).toMatchObject({ specializationName: 'Dermatology', score: 3 });
    expect(result.specializations[0]?.reasons).toEqual([
      expect.objectContaining({ symptomName: 'Skin rash', specializationName: 'Dermatology', weight: 3, source: 'selected' }),
    ]);
    expect(result.doctors.map((d) => d.doctorId)).toContain('doc-derm');
  });

  it('Symptom found in the description', () => {
    const result = match({
      symptomIds: [],
      descriptionText: "I've had a bad migraine since yesterday.",
      catalog: CATALOG,
      patientAge: 30,
      doctors: [],
    });

    expect(result.matchedSymptoms).toEqual([{ symptomId: 'headache', symptomName: 'Headache', source: 'described' }]);
    expect(result.specializations.map((s) => s.specializationName)).toEqual(['Neurology', 'General Practice']);
  });

  it('Weights add up', () => {
    const result = match({
      symptomIds: ['headache', 'cough'],
      catalog: CATALOG,
      patientAge: 30,
      doctors: [],
    });

    const bySpec = new Map(result.specializations.map((s) => [s.specializationName, s.score]));
    expect(bySpec.get('General Practice')).toBe(3);
    expect(bySpec.get('Neurology')).toBe(3);
    expect(bySpec.get('Pulmonology')).toBe(2);
    expect(result.specializations.map((s) => s.specializationName)).toEqual([
      'General Practice',
      'Neurology',
      'Pulmonology',
    ]);
  });

  it('Under-18 patient', () => {
    const result = match({
      symptomIds: ['cough'],
      catalog: CATALOG,
      patientAge: 12,
      doctors: [],
    });

    expect(result.specializations[0]?.specializationName).toBe('Pediatrics');
    expect(result.specializations[0]?.reasons).toEqual(
      expect.arrayContaining([expect.objectContaining({ source: 'age', specializationName: 'Pediatrics' })]),
    );
  });

  it('No match', () => {
    const result = match({
      symptomIds: [],
      descriptionText: "I just don't feel right",
      catalog: CATALOG,
      patientAge: 30,
      doctors: [doctor('doc-gp', 'Dr. General', [GENERAL_PRACTICE.specializationId])],
    });

    expect(result.matchedSymptoms).toEqual([]);
    expect(result.specializations).toEqual([
      expect.objectContaining({
        specializationName: 'General Practice',
        score: 1,
        reasons: [expect.objectContaining({ source: 'default' })],
      }),
    ]);
    expect(result.doctors.map((d) => d.doctorId)).toContain('doc-gp');
  });

  it('Deterministic result', () => {
    const doctors = [doctor('doc-1', 'Dr. One', [NEUROLOGY.specializationId]), doctor('doc-2', 'Dr. Two', [GENERAL_PRACTICE.specializationId])];
    const params = {
      symptomIds: ['headache', 'cough'],
      catalog: CATALOG,
      patientAge: 30,
      doctors,
    };

    const first = match(params);
    const second = match(params);
    expect(second).toEqual(first);
  });

  it('Red flag selected', () => {
    const result = match({
      symptomIds: ['chest-pain'],
      catalog: CATALOG,
      patientAge: 30,
      doctors: [doctor('doc-cardio', 'Dr. Heart', [CARDIOLOGY.specializationId])],
    });

    expect(result.urgent).toBe(true);
    expect(result.redFlags).toEqual([{ symptomId: 'chest-pain', symptomName: 'Chest pain' }]);
    expect(result.specializations.map((s) => s.specializationName)).toContain('Cardiology');
  });

  it('Red flag described', () => {
    const result = match({
      symptomIds: [],
      descriptionText: 'I am having difficulty breathing right now',
      catalog: CATALOG,
      patientAge: 30,
      doctors: [],
    });

    expect(result.urgent).toBe(true);
    expect(result.redFlags).toEqual([{ symptomId: 'difficulty-breathing', symptomName: 'Difficulty breathing' }]);
  });

  it('normalization: ignores punctuation around a keyword', () => {
    const result = match({
      symptomIds: [],
      descriptionText: 'chest-pain, chest-tightness!',
      catalog: CATALOG,
      patientAge: 30,
      doctors: [],
    });
    expect(result.matchedSymptoms.map((m) => m.symptomId)).toEqual(['chest-pain']);
  });

  it('ranks doctors by score, then soonest next slot (none last), then name', () => {
    const soon = doctor('doc-soon', 'Dr. Soon', [NEUROLOGY.specializationId], new Date('2026-01-02T00:00:00Z'));
    const later = doctor('doc-later', 'Dr. Later', [NEUROLOGY.specializationId], new Date('2026-01-05T00:00:00Z'));
    const none = doctor('doc-none', 'Dr. None', [NEUROLOGY.specializationId], null);

    const result = match({
      symptomIds: ['headache'],
      catalog: CATALOG,
      patientAge: 30,
      doctors: [none, later, soon],
    });

    expect(result.doctors.map((d) => d.doctorId)).toEqual(['doc-soon', 'doc-later', 'doc-none']);
  });

  it('caps doctors at 10 and specializations at 3', () => {
    const manyDoctors = Array.from({ length: 15 }, (_, i) =>
      doctor(`doc-${i}`, `Dr. Number ${String(i).padStart(2, '0')}`, [NEUROLOGY.specializationId]),
    );
    const result = match({
      symptomIds: ['headache', 'cough', 'skin-rash', 'anxiety'], // 4 distinct specializations matched
      catalog: CATALOG,
      patientAge: 30,
      doctors: manyDoctors,
    });

    expect(result.specializations).toHaveLength(3);
    expect(result.doctors).toHaveLength(10);
  });
});
