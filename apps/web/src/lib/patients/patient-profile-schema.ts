import { z } from 'zod';

const PHONE_PATTERN = /^\+?\d{7,20}$/;
const MAX_AGE_YEARS = 120;

function emptyToUndefined(value: unknown): unknown {
  return typeof value === 'string' && value.trim() === '' ? undefined : value;
}

function isValidBirthDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  if (date.getTime() >= now.getTime()) return false;
  const minDate = new Date(now);
  minDate.setUTCFullYear(minDate.getUTCFullYear() - MAX_AGE_YEARS);
  return date.getTime() >= minDate.getTime();
}

const optionalText = (max: number) =>
  z.preprocess(
    emptyToUndefined,
    z.string().max(max, `Must be at most ${max} characters`).optional(),
  );

const optionalPhone = () =>
  z.preprocess(
    emptyToUndefined,
    z.string().regex(PHONE_PATTERN, '7-20 digits, optional leading +').optional(),
  );

const optionalNumber = (min: number, max: number, label: string) =>
  z.preprocess(
    emptyToUndefined,
    z.coerce
      .number({ message: `${label} must be a number` })
      .min(min, `${label} must be at least ${min}`)
      .max(max, `${label} must be at most ${max}`)
      .optional(),
  );

/** Mirrors `UpdatePatientProfileDto`'s validation for inline form errors. */
export const patientProfileSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  birthDate: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .refine(isValidBirthDate, 'Enter a past date implying an age of at most 120 years')
      .optional(),
  ),
  weightKg: optionalNumber(1, 500, 'Weight'),
  heightCm: optionalNumber(30, 272, 'Height'),
  phone: optionalPhone(),
  emergencyContactName: optionalText(100),
  emergencyContactPhone: optionalPhone(),
  medicalConditions: optionalText(2000),
  allergies: optionalText(2000),
  currentMedications: optionalText(2000),
});

// Several fields use `z.preprocess` (to turn an empty string into "unset"),
// which makes zod's *input* type (raw, pre-validation form values) differ
// from its *output* type (parsed values passed to `onSubmit`). `useForm`
// takes both generics for exactly this case; using only one (`z.infer`,
// which is the output type) mismatches `zodResolver`'s inferred input type.
export type PatientProfileFormInput = z.input<typeof patientProfileSchema>;
export type PatientProfileFormValues = z.output<typeof patientProfileSchema>;
