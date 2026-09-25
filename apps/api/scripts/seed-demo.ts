import 'reflect-metadata';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { seedDemoDataset, type SeedResult } from './seed/build-dataset.js';
import { stageLiveConsultation as stageLiveConsultationImpl, type LiveConsultationResult } from './seed/live-consultation.js';
import { resetDemoData as resetDemoDataImpl, type ResetResult } from './seed/reset.js';

export {
  DEMO_DOMAIN,
  DEMO_PASSWORD,
  PRIMARY_DOCTOR_EMAIL,
  PRIMARY_PATIENT_EMAIL,
  LIVE_CONSULTATION_REASON_PREFIX,
} from './seed/constants.js';
export type { SeedResult } from './seed/build-dataset.js';
export type { LiveConsultationResult } from './seed/live-consultation.js';
export type { ResetResult } from './seed/reset.js';

function requireDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to run the demo seed.');
  }
  return databaseUrl;
}

/** Opens a short-lived Prisma connection for one call, then closes it — each exported function below is self-contained. */
async function withPrisma<T>(run: (prisma: PrismaClient) => Promise<T>): Promise<T> {
  const adapter = new PrismaPg(requireDatabaseUrl());
  const prisma = new PrismaClient({ adapter });
  try {
    return await run(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

/** Loads the demo dataset if it isn't present yet (see the `demo-data` spec's "Automatic demo dataset"). */
export async function seedDemoData(now?: Date): Promise<SeedResult> {
  return withPrisma((prisma) => seedDemoDataset(prisma, now));
}

/** Stages a `BOOKED` appointment between the primary demo patient and doctor starting 10 minutes from now. */
export async function stageLiveConsultation(now?: Date): Promise<LiveConsultationResult> {
  return withPrisma((prisma) => stageLiveConsultationImpl(prisma, now));
}

/** Removes every demo account and its records, leaving non-demo data untouched. */
export async function resetDemoData(): Promise<ResetResult> {
  return withPrisma((prisma) => resetDemoDataImpl(prisma));
}

/**
 * CLI entrypoint (run directly with `node`, like `provision-admin.ts`, so it
 * never runs as a side effect of the app booting). Three modes, selected by
 * flag: default seeds, `--live-consultation` stages one, `--reset` clears
 * demo data. Run from the docker entrypoint (after `provision-admin`) when
 * `DEMO_DATA=true`, or locally via `pnpm --filter api run demo:seed` /
 * `pnpm demo:live` / `pnpm --filter api run demo:reset`.
 */
async function main(): Promise<void> {
  const mode = process.argv.includes('--live-consultation')
    ? 'live-consultation'
    : process.argv.includes('--reset')
      ? 'reset'
      : 'seed';

  if (mode === 'live-consultation') {
    await stageLiveConsultation();
  } else if (mode === 'reset') {
    await resetDemoData();
  } else {
    await seedDemoData();
  }
}

// Only run as a CLI when invoked directly (`node dist/scripts/seed-demo.js`), not when imported
// by the e2e test suite, which calls the exported functions directly against its own test DB.
const isMain = process.argv[1]?.endsWith('seed-demo.js') || process.argv[1]?.endsWith('seed-demo.ts');
if (isMain) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
