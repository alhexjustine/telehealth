import 'reflect-metadata';
import { hash } from '@node-rs/argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { Role } from '../src/generated/prisma/enums.js';

/**
 * Creates the pre-provisioned administrator from `ADMIN_EMAIL`/`ADMIN_PASSWORD`
 * if no account with that email exists yet. Never updates an existing account
 * (a restart must not silently change the admin's password). Run from the
 * docker entrypoint after `prisma migrate deploy`, and locally via
 * `pnpm --filter api run admin:provision`.
 *
 * Runs as a standalone script (not a Nest `onApplicationBootstrap` hook) so it
 * never touches the database as a side effect of the app booting: that would
 * break database-free OpenAPI generation and the "database unreachable"
 * health-check e2e scenario, both of which construct the app without a live
 * database.
 */
async function main(): Promise<void> {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.log('ADMIN_EMAIL/ADMIN_PASSWORD not set; skipping admin provisioning.');
    return;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is required to provision the admin account.');
    process.exit(1);
  }

  const normalizedEmail = email.toLowerCase();
  const adapter = new PrismaPg(databaseUrl);
  const prisma = new PrismaClient({ adapter });

  try {
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      console.log(`Admin account ${normalizedEmail} already exists; leaving it unchanged.`);
      return;
    }

    const passwordHash = await hash(password);
    await prisma.user.create({ data: { email: normalizedEmail, passwordHash, role: Role.ADMIN } });
    console.log(`Admin account ${normalizedEmail} provisioned.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
