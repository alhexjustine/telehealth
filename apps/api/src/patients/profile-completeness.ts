export interface PatientProfileCompletenessInput {
  firstName: string | null | undefined;
  lastName: string | null | undefined;
  birthDate: unknown;
  weightKg: unknown;
  heightCm: unknown;
  phone: string | null | undefined;
}

function isSet(value: unknown): boolean {
  return value !== null && value !== undefined && value !== '';
}

/**
 * A patient profile is complete when first name, last name, birthday, weight,
 * height, and phone number are all set. Medical history and the emergency
 * contact are deliberately excluded. Computed on read (never stored) so it
 * can't drift from the fields it depends on.
 */
export function isPatientProfileComplete(profile: PatientProfileCompletenessInput): boolean {
  return (
    isSet(profile.firstName) &&
    isSet(profile.lastName) &&
    isSet(profile.birthDate) &&
    isSet(profile.weightKg) &&
    isSet(profile.heightCm) &&
    isSet(profile.phone)
  );
}
