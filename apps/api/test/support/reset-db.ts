import { PrismaClient } from '../../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * Truncates every table except `specializations` (fixed reference data seeded by
 * migrations, never written by tests). Called between e2e spec files so tests are
 * order-independent regardless of which file Jest runs first.
 */
export async function resetDatabase(): Promise<void> {
  const adapter = new PrismaPg(
    process.env.DATABASE_URL ??
      'postgresql://telehealth:telehealth@localhost:5432/telehealth_test?schema=public',
  );
  const prisma = new PrismaClient({ adapter });
  try {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "users", "sessions", "patient_profiles", "doctor_profiles", "doctor_specializations" RESTART IDENTITY CASCADE;',
    );
  } finally {
    await prisma.$disconnect();
  }
}
