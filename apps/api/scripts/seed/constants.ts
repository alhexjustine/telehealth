/**
 * Everything that identifies "this is demo data" lives here, in one place,
 * so the seed, the live-consultation stager, and the reset command can never
 * disagree about the reserved domain or the shared password (see design.md's
 * "Seed script design").
 */

/** Every demo account's email ends in this domain — reset matches on it. */
export const DEMO_DOMAIN = 'demo.telehealth.local';

/** Shared by every demo account. Documented in README.md and docs/guide/demo.md. */
export const DEMO_PASSWORD = 'Demo-Password-2026';

/** The account whose presence means "the demo dataset is already loaded" (see `isDemoDataPresent`). */
export const PRIMARY_PATIENT_EMAIL = `patient@${DEMO_DOMAIN}`;
export const PRIMARY_DOCTOR_EMAIL = `doctor@${DEMO_DOMAIN}`;

/** Reserved reason prefix for the appointment `--live-consultation` stages, so it can find and replace its own previous run. */
export const LIVE_CONSULTATION_REASON_PREFIX = '[demo-live]';

export function demoEmail(localPart: string): string {
  return `${localPart}@${DEMO_DOMAIN}`;
}
