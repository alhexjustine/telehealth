import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { resetDatabase } from './support/reset-db.js';

const execFileAsync = promisify(execFile);
const __dirname = resolve(fileURLToPath(import.meta.url), '..');
const scriptPath = resolve(__dirname, '../dist/scripts/provision-admin.js');
const databaseUrl =
  process.env.DATABASE_URL ??
  'postgresql://telehealth:telehealth@localhost:5432/telehealth_test?schema=public';

function runScript(env: Record<string, string>): Promise<{ stdout: string; stderr: string }> {
  // Start from a clean slate (not `process.env`) so a previous test's
  // ADMIN_EMAIL/ADMIN_PASSWORD can't leak into "Skips provisioning when unset".
  return execFileAsync(process.execPath, [scriptPath], {
    env: { PATH: process.env.PATH ?? '', DATABASE_URL: databaseUrl, ...env },
  });
}

describe('Admin provisioning', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    await resetDatabase();
    prisma = new PrismaClient({ adapter: new PrismaPg(databaseUrl) });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('First startup', async () => {
    const email = 'admin@telehealth.local';
    const { stdout } = await runScript({ ADMIN_EMAIL: email, ADMIN_PASSWORD: 'ChangeMe-Admin-2026' });

    expect(stdout).toContain('provisioned');
    const admin = await prisma.user.findUnique({ where: { email } });
    expect(admin).not.toBeNull();
    expect(admin?.role).toBe('ADMIN');
    expect(admin?.status).toBe('ACTIVE');
  });

  it('Restart does not overwrite', async () => {
    const email = 'admin@telehealth.local';
    const before = await prisma.user.findUniqueOrThrow({ where: { email } });

    const { stdout } = await runScript({ ADMIN_EMAIL: email, ADMIN_PASSWORD: 'SomeOtherPassword123' });

    expect(stdout).toContain('unchanged');
    const after = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(after.passwordHash).toBe(before.passwordHash);
  });

  it('Skips provisioning when unset', async () => {
    const before = await prisma.user.count();
    const { stdout } = await runScript({});

    expect(stdout).toContain('skipping');
    expect(await prisma.user.count()).toBe(before);
  });
});
