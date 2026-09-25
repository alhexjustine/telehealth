import { describe, expect, it } from '@jest/globals';
import { isPatientProfileComplete } from './profile-completeness.js';

const base = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  birthDate: new Date('1990-01-01'),
  weightKg: 60,
  heightCm: 165,
  phone: '+15551234567',
};

describe('isPatientProfileComplete', () => {
  it('is incomplete for a newly registered patient with only name', () => {
    expect(
      isPatientProfileComplete({
        firstName: 'Ada',
        lastName: 'Lovelace',
        birthDate: null,
        weightKg: null,
        heightCm: null,
        phone: null,
      }),
    ).toBe(false);
  });

  it('is complete once required fields are filled, with no medical history', () => {
    expect(isPatientProfileComplete(base)).toBe(true);
  });

  it('is incomplete when any single required field is missing', () => {
    expect(isPatientProfileComplete({ ...base, phone: null })).toBe(false);
    expect(isPatientProfileComplete({ ...base, weightKg: undefined })).toBe(false);
    expect(isPatientProfileComplete({ ...base, birthDate: undefined })).toBe(false);
  });
});
