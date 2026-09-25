import { describe, expect, it } from '@jest/globals';
import { isValidBirthDate } from './patient-profile-validation.js';

const now = new Date('2026-06-15T00:00:00.000Z');

describe('isValidBirthDate', () => {
  it('accepts a birthday well in the past', () => {
    expect(isValidBirthDate('1990-01-01', now)).toBe(true);
  });

  it('rejects a future birthday', () => {
    expect(isValidBirthDate('2030-01-01', now)).toBe(false);
  });

  it('rejects today', () => {
    expect(isValidBirthDate('2026-06-15', now)).toBe(false);
  });

  it('accepts a birthday implying exactly 120 years old', () => {
    expect(isValidBirthDate('1906-06-16', now)).toBe(true);
  });

  it('rejects a birthday implying more than 120 years old', () => {
    expect(isValidBirthDate('1906-06-14', now)).toBe(false);
  });

  it('rejects a malformed date string', () => {
    expect(isValidBirthDate('not-a-date', now)).toBe(false);
  });
});
