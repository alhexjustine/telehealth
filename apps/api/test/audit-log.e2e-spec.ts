import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { createTestApp } from './support/test-app.js';
import { resetDatabase } from './support/reset-db.js';
import { createAndSignInAdmin } from './support/auth-helpers.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Audit log foundation', () => {
  let app: INestApplication;

  beforeEach(async () => {
    await resetDatabase();
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('Admin sign-in audited', async () => {
    const admin = await createAndSignInAdmin(app);
    const prisma = app.get(PrismaService);

    const entries = await prisma.auditLog.findMany({
      where: { actorId: admin.id, action: 'ADMIN_SIGNED_IN' },
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ entityType: 'User', entityId: admin.id });
    expect(entries[0]?.requestId).toEqual(expect.any(String));
    expect(entries[0]?.requestId.length).toBeGreaterThan(0);
  });

  it('Database blocks changes', async () => {
    const admin = await createAndSignInAdmin(app);
    const prisma = app.get(PrismaService);
    const entry = await prisma.auditLog.findFirstOrThrow({ where: { actorId: admin.id } });

    await expect(
      prisma.$executeRawUnsafe(`UPDATE "audit_logs" SET reason = 'tampered' WHERE id = $1`, entry.id),
    ).rejects.toThrow(/append-only/);

    await expect(
      prisma.$executeRawUnsafe(`DELETE FROM "audit_logs" WHERE id = $1`, entry.id),
    ).rejects.toThrow(/append-only/);

    const stillThere = await prisma.auditLog.findUnique({ where: { id: entry.id } });
    expect(stillThere).not.toBeNull();
    expect(stillThere?.reason).not.toBe('tampered');
  });
});
