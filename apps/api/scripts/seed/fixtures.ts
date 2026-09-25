import { VerificationStatus, AccountStatus } from '../../src/generated/prisma/enums.js';
import type { AvailabilityRuleInput } from '../../src/availability/slot-generator.js';
import { demoEmail } from './constants.js';

/** Fixed IDs from `20260925081535_add_profiles_specializations`'s catalog seed — stable across every environment. */
export const SPECIALIZATION_SLUG_TO_ID: Record<string, string> = {
  'general-practice': '59377a7b-de0f-48cc-a665-4f3fa14ea549',
  'internal-medicine': 'b2cf7501-73f6-474c-819f-f33855012d4c',
  pediatrics: 'ad6c4b25-4848-4881-9ae2-f2a559250c93',
  dermatology: '9774a039-8de3-4674-9f50-957ea52972a4',
  cardiology: '0ba9026e-4e84-4bb8-baaf-e88f42b2d12e',
  neurology: 'a3b810e7-87c0-43c9-83da-5903b5185602',
  psychiatry: '6e4df4a9-22f6-4f7b-b4e5-bdb11a296784',
  'obstetrics-gynecology': 'a6f0cc3f-b579-464d-ada6-ba3aaf337cf4',
  ent: '38e51b7e-2f73-489f-8a26-6ffa605a0039',
  orthopedics: 'f37101a0-c00e-4bfb-953e-b5fe3dac30dd',
  gastroenterology: '5acf7dc1-4c07-4bf4-b38f-c2537c9bfb22',
  pulmonology: '1ac5d4f5-7576-443d-9a66-7f16cec3d11a',
  endocrinology: '9865cac0-513b-4bcd-a74e-8750efe1e3fd',
};

function weeklyRule(weekday: number, startHour: number, endHour: number): AvailabilityRuleInput {
  return { weekday, startMinute: startHour * 60, endMinute: endHour * 60 };
}

export interface DemoDoctorFixture {
  emailLocalPart: string;
  firstName: string;
  lastName: string;
  bio: string;
  yearsOfExperience: number;
  licenseNumber: string;
  timezone: string;
  consultationMinutes: number;
  specializationSlugs: string[];
  verificationStatus: VerificationStatus;
  reviewNote: string | null;
  accountStatus: AccountStatus;
  statusReason: string | null;
  /** Empty for doctors that never need bookable slots (pending/rejected/suspended). */
  rules: AvailabilityRuleInput[];
}

const APPROVED = VerificationStatus.APPROVED;
const ACTIVE = AccountStatus.ACTIVE;

/**
 * 8 approved doctors covering 8 distinct catalog specializations (one, the
 * primary demo doctor, deliberately first so `PRIMARY_DOCTOR_EMAIL` always
 * resolves to a predictable profile), plus one pending, one rejected (with a
 * review note), and one suspended — see the `demo-data` spec's "Demo dataset
 * contents".
 */
export const DEMO_DOCTORS: DemoDoctorFixture[] = [
  {
    emailLocalPart: 'doctor',
    firstName: 'Maria',
    lastName: 'Santos',
    bio: 'General practitioner focused on everyday health concerns and preventive care.',
    yearsOfExperience: 12,
    licenseNumber: 'DEMO-GP-0001',
    timezone: 'Asia/Manila',
    consultationMinutes: 30,
    specializationSlugs: ['general-practice'],
    verificationStatus: APPROVED,
    reviewNote: null,
    accountStatus: ACTIVE,
    statusReason: null,
    rules: [1, 2, 3, 4, 5].map((weekday) => weeklyRule(weekday, 9, 17)),
  },
  {
    emailLocalPart: 'dr.cardiology',
    firstName: 'Michael',
    lastName: 'Chen',
    bio: 'Cardiologist specializing in hypertension and preventive heart health.',
    yearsOfExperience: 15,
    licenseNumber: 'DEMO-CARD-0002',
    timezone: 'Asia/Manila',
    consultationMinutes: 30,
    specializationSlugs: ['cardiology'],
    verificationStatus: APPROVED,
    reviewNote: null,
    accountStatus: ACTIVE,
    statusReason: null,
    rules: [1, 3, 5].map((weekday) => weeklyRule(weekday, 8, 14)),
  },
  {
    emailLocalPart: 'dr.pediatrics',
    firstName: 'Ana',
    lastName: 'Reyes',
    bio: 'Pediatrician caring for infants through adolescents.',
    yearsOfExperience: 9,
    licenseNumber: 'DEMO-PED-0003',
    timezone: 'Asia/Manila',
    consultationMinutes: 30,
    specializationSlugs: ['pediatrics'],
    verificationStatus: APPROVED,
    reviewNote: null,
    accountStatus: ACTIVE,
    statusReason: null,
    rules: [2, 4].map((weekday) => weeklyRule(weekday, 9, 16)),
  },
  {
    emailLocalPart: 'dr.dermatology',
    firstName: 'Liza',
    lastName: 'Cruz',
    bio: 'Dermatologist treating skin, hair, and nail conditions.',
    yearsOfExperience: 7,
    licenseNumber: 'DEMO-DERM-0004',
    timezone: 'Asia/Manila',
    consultationMinutes: 30,
    specializationSlugs: ['dermatology'],
    verificationStatus: APPROVED,
    reviewNote: null,
    accountStatus: ACTIVE,
    statusReason: null,
    rules: [1, 2, 3, 4, 5].map((weekday) => weeklyRule(weekday, 13, 17)),
  },
  {
    emailLocalPart: 'dr.neurology',
    firstName: 'James',
    lastName: 'Bautista',
    bio: 'Neurologist focused on headache disorders and nerve conditions.',
    yearsOfExperience: 18,
    licenseNumber: 'DEMO-NEURO-0005',
    timezone: 'Asia/Manila',
    consultationMinutes: 30,
    specializationSlugs: ['neurology'],
    verificationStatus: APPROVED,
    reviewNote: null,
    accountStatus: ACTIVE,
    statusReason: null,
    rules: [1, 2, 3].map((weekday) => weeklyRule(weekday, 10, 15)),
  },
  {
    emailLocalPart: 'dr.psychiatry',
    firstName: 'Carmen',
    lastName: 'Villanueva',
    bio: 'Psychiatrist providing mental health assessment and treatment.',
    yearsOfExperience: 11,
    licenseNumber: 'DEMO-PSYCH-0006',
    timezone: 'Asia/Manila',
    consultationMinutes: 30,
    specializationSlugs: ['psychiatry'],
    verificationStatus: APPROVED,
    reviewNote: null,
    accountStatus: ACTIVE,
    statusReason: null,
    rules: [3, 4, 5].map((weekday) => weeklyRule(weekday, 9, 13)),
  },
  {
    emailLocalPart: 'dr.obgyn',
    firstName: 'Patricia',
    lastName: 'Lim',
    bio: 'OB-GYN caring for pregnancy, childbirth, and reproductive health.',
    yearsOfExperience: 14,
    licenseNumber: 'DEMO-OBGYN-0007',
    timezone: 'Asia/Manila',
    consultationMinutes: 30,
    specializationSlugs: ['obstetrics-gynecology'],
    verificationStatus: APPROVED,
    reviewNote: null,
    accountStatus: ACTIVE,
    statusReason: null,
    rules: [1, 4].map((weekday) => weeklyRule(weekday, 9, 15)),
  },
  {
    // The one doctor in a different time zone from the rest of the roster
    // (`demo-data` spec's "at least one of them in a time zone other than
    // the others").
    emailLocalPart: 'dr.internalmed',
    firstName: 'Robert',
    lastName: 'Tan',
    bio: 'Internal medicine physician managing chronic adult conditions.',
    yearsOfExperience: 20,
    licenseNumber: 'DEMO-IM-0008',
    timezone: 'America/New_York',
    consultationMinutes: 30,
    specializationSlugs: ['internal-medicine'],
    verificationStatus: APPROVED,
    reviewNote: null,
    accountStatus: ACTIVE,
    statusReason: null,
    rules: [1, 2, 3, 4, 5].map((weekday) => weeklyRule(weekday, 8, 12)),
  },
  {
    emailLocalPart: 'dr.pending',
    firstName: 'Sofia',
    lastName: 'Garcia',
    bio: 'Endocrinologist awaiting administrator review.',
    yearsOfExperience: 6,
    licenseNumber: 'DEMO-PEND-0009',
    timezone: 'Asia/Manila',
    consultationMinutes: 30,
    specializationSlugs: ['endocrinology'],
    verificationStatus: VerificationStatus.PENDING,
    reviewNote: null,
    accountStatus: ACTIVE,
    statusReason: null,
    rules: [],
  },
  {
    emailLocalPart: 'dr.rejected',
    firstName: 'Mark',
    lastName: 'Delgado',
    bio: 'Orthopedic surgeon.',
    yearsOfExperience: 4,
    licenseNumber: 'DEMO-REJ-0010',
    timezone: 'Asia/Manila',
    consultationMinutes: 30,
    specializationSlugs: ['orthopedics'],
    verificationStatus: VerificationStatus.REJECTED,
    reviewNote: "License number could not be verified against the regulator's registry.",
    accountStatus: ACTIVE,
    statusReason: null,
    rules: [],
  },
  {
    emailLocalPart: 'dr.suspended',
    firstName: 'Elena',
    lastName: 'Ramos',
    bio: 'Gastroenterologist, account currently suspended.',
    yearsOfExperience: 10,
    licenseNumber: 'DEMO-SUSP-0011',
    timezone: 'Asia/Manila',
    consultationMinutes: 30,
    specializationSlugs: ['gastroenterology'],
    verificationStatus: APPROVED,
    reviewNote: null,
    accountStatus: AccountStatus.SUSPENDED,
    statusReason: 'Suspended pending a routine compliance review (demo).',
    rules: [1, 2, 3, 4, 5].map((weekday) => weeklyRule(weekday, 9, 17)),
  },
];

export interface DemoPatientFixture {
  emailLocalPart: string;
  firstName: string;
  lastName: string;
  birthDate: string | null;
  weightKg: number | null;
  heightCm: number | null;
  phone: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  medicalConditions: string | null;
  allergies: string | null;
  currentMedications: string | null;
  accountStatus: AccountStatus;
  statusReason: string | null;
}

/** `demo-data` spec's "a primary demo patient..., a patient under 18, a patient with an incomplete profile, and a suspended patient". */
export const DEMO_PATIENTS: DemoPatientFixture[] = [
  {
    emailLocalPart: 'patient',
    firstName: 'Ana',
    lastName: 'Dela Cruz',
    birthDate: '1990-04-12',
    weightKg: 58,
    heightCm: 162,
    phone: '+639171234567',
    emergencyContactName: 'Jose Dela Cruz',
    emergencyContactPhone: '+639171234568',
    medicalConditions: 'Mild asthma, well controlled.',
    allergies: 'Penicillin.',
    currentMedications: 'Albuterol inhaler, as needed.',
    accountStatus: ACTIVE,
    statusReason: null,
  },
  {
    emailLocalPart: 'patient.minor',
    firstName: 'Miguel',
    lastName: 'Dela Cruz',
    birthDate: new Date(new Date().getUTCFullYear() - 10, 5, 15).toISOString().slice(0, 10),
    weightKg: 32,
    heightCm: 135,
    phone: '+639171234570',
    emergencyContactName: 'Ana Dela Cruz',
    emergencyContactPhone: '+639171234567',
    medicalConditions: null,
    allergies: null,
    currentMedications: null,
    accountStatus: ACTIVE,
    statusReason: null,
  },
  {
    emailLocalPart: 'patient.incomplete',
    firstName: 'Carlo',
    lastName: 'Reyes',
    birthDate: null,
    weightKg: null,
    heightCm: null,
    phone: null,
    emergencyContactName: null,
    emergencyContactPhone: null,
    medicalConditions: null,
    allergies: null,
    currentMedications: null,
    accountStatus: ACTIVE,
    statusReason: null,
  },
  {
    emailLocalPart: 'patient.suspended',
    firstName: 'Beatriz',
    lastName: 'Santos',
    birthDate: '1985-09-01',
    weightKg: 65,
    heightCm: 158,
    phone: '+639171234571',
    emergencyContactName: null,
    emergencyContactPhone: null,
    medicalConditions: null,
    allergies: null,
    currentMedications: null,
    accountStatus: AccountStatus.SUSPENDED,
    statusReason: 'Suspended for suspicious account activity (demo).',
  },
];

export function doctorEmail(fixture: DemoDoctorFixture): string {
  return demoEmail(fixture.emailLocalPart);
}

export function patientEmail(fixture: DemoPatientFixture): string {
  return demoEmail(fixture.emailLocalPart);
}
