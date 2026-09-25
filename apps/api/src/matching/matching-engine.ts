/**
 * The deterministic symptom-matching algorithm: a pure function over catalog
 * data and pre-fetched doctors, with no I/O and no clock of its own — see
 * design.md's "Matching engine" and the `doctor-matching` spec's
 * "Deterministic matching algorithm" requirement for the exact steps.
 */

const TOP_SPECIALIZATION_COUNT = 3;
const MAX_DOCTORS = 10;
const NO_MATCH_SCORE = 1;
const UNDER_18_BONUS = 4;

export interface MatchingSymptomLink {
  specializationId: string;
  specializationName: string;
  /** 1-3. */
  weight: number;
}

export interface MatchingSymptom {
  id: string;
  name: string;
  keywords: string[];
  isRedFlag: boolean;
  links: MatchingSymptomLink[];
}

/**
 * The catalog plus the two specializations the algorithm special-cases:
 * General Practice (the fallback when nothing matches) and Pediatrics (the
 * under-18 rule). Kept out of `symptoms` so the engine never has to search
 * for them by a hardcoded name.
 */
export interface MatchingCatalog {
  symptoms: MatchingSymptom[];
  generalPractice: { specializationId: string; specializationName: string };
  pediatrics: { specializationId: string; specializationName: string };
}

export interface MatchingDoctor {
  id: string;
  displayName: string;
  specializationIds: string[];
  /** Start of the doctor's next available slot within 14 days, or `null`. */
  nextAvailableSlot: Date | null;
}

export type MatchReasonSource = 'selected' | 'described' | 'age' | 'default';

export interface MatchReason {
  symptomId: string | null;
  symptomName: string | null;
  specializationId: string;
  specializationName: string;
  weight: number;
  source: MatchReasonSource;
}

export interface MatchedSymptom {
  symptomId: string;
  symptomName: string;
  source: 'selected' | 'described';
}

export interface RedFlagMatch {
  symptomId: string;
  symptomName: string;
}

export interface SpecializationMatch {
  specializationId: string;
  specializationName: string;
  score: number;
  reasons: MatchReason[];
}

export interface DoctorMatch {
  doctorId: string;
  displayName: string;
  specializationId: string;
  score: number;
  reasons: MatchReason[];
  nextAvailableSlot: Date | null;
}

export interface MatchResult {
  urgent: boolean;
  redFlags: RedFlagMatch[];
  matchedSymptoms: MatchedSymptom[];
  specializations: SpecializationMatch[];
  doctors: DoctorMatch[];
}

export interface MatchParams {
  symptomIds: string[];
  descriptionText?: string;
  catalog: MatchingCatalog;
  /** `null` when the patient's birthday isn't set — the age rule is skipped. */
  patientAge: number | null;
  doctors: MatchingDoctor[];
}

/** Lowercase, non-letters to spaces, collapse whitespace. Exported for reuse by callers that need the same normalization (e.g. tests). */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function keywordMatches(normalizedText: string, keyword: string): boolean {
  const normalizedKeyword = normalizeText(keyword);
  if (normalizedKeyword === '') return false;
  return ` ${normalizedText} `.includes(` ${normalizedKeyword} `);
}

export function match(params: MatchParams): MatchResult {
  const { symptomIds, descriptionText, catalog, patientAge, doctors } = params;

  const catalogById = new Map(catalog.symptoms.map((symptom) => [symptom.id, symptom]));
  const normalizedDescription = descriptionText ? normalizeText(descriptionText) : '';

  const matchedSymptoms: MatchedSymptom[] = [];
  const matchedIds = new Set<string>();

  // Selected first, so a symptom that's both selected and mentioned in the
  // description is labeled "selected" (it's still counted once either way).
  for (const symptomId of symptomIds) {
    const symptom = catalogById.get(symptomId);
    if (!symptom || matchedIds.has(symptomId)) continue;
    matchedIds.add(symptomId);
    matchedSymptoms.push({ symptomId: symptom.id, symptomName: symptom.name, source: 'selected' });
  }
  if (normalizedDescription !== '') {
    for (const symptom of catalog.symptoms) {
      if (matchedIds.has(symptom.id)) continue;
      const found = symptom.keywords.some((keyword) => keywordMatches(normalizedDescription, keyword));
      if (found) {
        matchedIds.add(symptom.id);
        matchedSymptoms.push({ symptomId: symptom.id, symptomName: symptom.name, source: 'described' });
      }
    }
  }

  const redFlags: RedFlagMatch[] = matchedSymptoms
    .filter((m) => catalogById.get(m.symptomId)?.isRedFlag)
    .map((m) => ({ symptomId: m.symptomId, symptomName: m.symptomName }));

  // Step 2: score each specialization as the sum of its weights to matched symptoms.
  const scores = new Map<string, SpecializationMatch>();
  function addReason(reason: MatchReason): void {
    const existing = scores.get(reason.specializationId);
    if (existing) {
      existing.score += reason.weight;
      existing.reasons.push(reason);
    } else {
      scores.set(reason.specializationId, {
        specializationId: reason.specializationId,
        specializationName: reason.specializationName,
        score: reason.weight,
        reasons: [reason],
      });
    }
  }

  for (const matched of matchedSymptoms) {
    const symptom = catalogById.get(matched.symptomId);
    if (!symptom) continue;
    for (const link of symptom.links) {
      addReason({
        symptomId: symptom.id,
        symptomName: symptom.name,
        specializationId: link.specializationId,
        specializationName: link.specializationName,
        weight: link.weight,
        source: matched.source,
      });
    }
  }

  // Step 4: nothing matched at all -> General Practice, score 1.
  if (matchedSymptoms.length === 0) {
    addReason({
      symptomId: null,
      symptomName: null,
      specializationId: catalog.generalPractice.specializationId,
      specializationName: catalog.generalPractice.specializationName,
      weight: NO_MATCH_SCORE,
      source: 'default',
    });
  }

  // Step 3: under-18 patients get Pediatrics boosted to 4 above the current highest score.
  if (patientAge !== null && patientAge < 18) {
    const currentHighest = Math.max(0, ...[...scores.values()].map((s) => s.score));
    const boosted = currentHighest + UNDER_18_BONUS;
    addReason({
      symptomId: null,
      symptomName: null,
      specializationId: catalog.pediatrics.specializationId,
      specializationName: catalog.pediatrics.specializationName,
      weight: boosted,
      source: 'age',
    });
    // `addReason` adds to any existing Pediatrics score; the rule instead sets
    // an absolute floor, so replace rather than accumulate when a symptom
    // already pointed at Pediatrics.
    const pediatrics = scores.get(catalog.pediatrics.specializationId)!;
    const priorReasons = pediatrics.reasons.filter((r) => r.source !== 'age');
    const priorScore = priorReasons.reduce((sum, r) => sum + r.weight, 0);
    pediatrics.score = Math.max(priorScore, boosted);
  }

  // Step 5: top three by score, ties broken by name.
  const specializations = [...scores.values()].sort(
    (a, b) => b.score - a.score || a.specializationName.localeCompare(b.specializationName),
  );
  const topSpecializations = specializations.slice(0, TOP_SPECIALIZATION_COUNT);
  const topById = new Map(topSpecializations.map((s) => [s.specializationId, s]));

  // Step 6: doctors with at least one of the top specializations, ranked by
  // their best matching specialization's score, then soonest next slot, then name.
  const doctorMatches: DoctorMatch[] = [];
  for (const doctor of doctors) {
    let best: SpecializationMatch | undefined;
    for (const specializationId of doctor.specializationIds) {
      const candidate = topById.get(specializationId);
      if (!candidate) continue;
      if (!best || candidate.score > best.score) best = candidate;
    }
    if (!best) continue;
    doctorMatches.push({
      doctorId: doctor.id,
      displayName: doctor.displayName,
      specializationId: best.specializationId,
      score: best.score,
      reasons: best.reasons,
      nextAvailableSlot: doctor.nextAvailableSlot,
    });
  }
  doctorMatches.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    const aNext = a.nextAvailableSlot?.getTime() ?? Number.POSITIVE_INFINITY;
    const bNext = b.nextAvailableSlot?.getTime() ?? Number.POSITIVE_INFINITY;
    if (aNext !== bNext) return aNext - bNext;
    return a.displayName.localeCompare(b.displayName);
  });

  return {
    urgent: redFlags.length > 0,
    redFlags,
    matchedSymptoms,
    specializations: topSpecializations,
    doctors: doctorMatches.slice(0, MAX_DOCTORS),
  };
}
