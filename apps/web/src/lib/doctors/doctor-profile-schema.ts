import { z } from 'zod';

const LICENSE_NUMBER_PATTERN = /^[A-Za-z0-9-]{4,32}$/;
const CONSULTATION_MINUTES = [15, 20, 30, 45, 60] as const;

export const doctorProfileSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  bio: z.string().max(2000, 'Must be at most 2000 characters').optional(),
  yearsOfExperience: z.preprocess(
    (value) => (value === '' || value === null || value === undefined ? undefined : Number(value)),
    z.number({ message: 'Years of experience must be a number' }).int().min(0).max(70).optional(),
  ),
  licenseNumber: z.string().regex(LICENSE_NUMBER_PATTERN, '4-32 letters, digits, or dashes'),
  consultationMinutes: z
    .number()
    .refine((v) => (CONSULTATION_MINUTES as readonly number[]).includes(v), {
      message: 'Choose 15, 20, 30, 45, or 60 minutes',
    }),
  specializationIds: z.array(z.string()).min(1, 'Select at least one specialization'),
});

// `yearsOfExperience` uses `z.preprocess`, so zod's input type (raw form
// values) differs from its output type (parsed values passed to onSubmit) —
// `useForm` needs both generics for that, not just `z.infer` (the output type).
export type DoctorProfileFormInput = z.input<typeof doctorProfileSchema>;
export type DoctorProfileFormValues = z.output<typeof doctorProfileSchema>;
export { CONSULTATION_MINUTES };
