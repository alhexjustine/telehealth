import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { createTestApp } from './support/test-app.js';
import { resetDatabase } from './support/reset-db.js';
import { registerDoctor, registerPatient } from './support/auth-helpers.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { postgresErrorCode } from '../src/common/errors/postgres-error.js';

/**
 * These constraints aren't declared in `schema.prisma` (Prisma can't express
 * an `EXCLUDE USING gist`), so nothing stops a future `prisma migrate dev`
 * from generating a migration that silently drops them. This suite is the
 * pin design.md calls for: it fails loudly if that ever happens.
 */
describe('Database-level appointment overlap prevention', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await resetDatabase();
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('Appointment exclusion constraints exist in pg_constraint', async () => {
    const prisma = app.get(PrismaService);
    const rows = await prisma.$queryRaw<{ conname: string; contype: string }[]>`
      SELECT conname, contype::TEXT AS contype FROM pg_constraint WHERE conname = ANY(${[
        'appointments_doctor_no_overlap',
        'appointments_patient_no_overlap',
        'appointments_valid_range',
      ]})
    `;

    const byName = new Map(rows.map((row) => [row.conname, row.contype]));
    // 'x' = exclusion constraint, 'c' = check constraint.
    expect(byName.get('appointments_doctor_no_overlap')).toBe('x');
    expect(byName.get('appointments_patient_no_overlap')).toBe('x');
    expect(byName.get('appointments_valid_range')).toBe('c');
  });

  describe('Database rejects overlap directly', () => {
    let doctorId: string;
    let patientAId: string;
    let patientBId: string;

    beforeEach(async () => {
      const doctor = await registerDoctor(app);
      const patientA = await registerPatient(app);
      const patientB = await registerPatient(app);
      doctorId = doctor.id;
      patientAId = patientA.id;
      patientBId = patientB.id;
    });

    afterEach(async () => {
      await resetDatabase();
    });

    it('an overlapping BOOKED row for the same doctor is rejected with 23P01', async () => {
      const prisma = app.get(PrismaService);
      const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const end = new Date(start.getTime() + 30 * 60 * 1000);
      const overlapStart = new Date(start.getTime() + 15 * 60 * 1000);
      const overlapEnd = new Date(overlapStart.getTime() + 30 * 60 * 1000);

      await prisma.appointment.create({
        data: {
          patientId: patientAId,
          doctorId,
          startsAt: start,
          endsAt: end,
          reason: 'First booking for the raw-insert test',
          status: 'BOOKED',
        },
      });

      let caught: unknown;
      try {
        await prisma.$executeRaw`
          INSERT INTO appointments (id, patient_id, doctor_id, starts_at, ends_at, reason, status, created_at, updated_at)
          VALUES (gen_random_uuid(), ${patientBId}::UUID, ${doctorId}::UUID, ${overlapStart}, ${overlapEnd}, 'Overlapping raw insert', 'BOOKED', now(), now())
        `;
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeDefined();
      expect(postgresErrorCode(caught)).toBe('23P01');
    });

    it('an overlapping CANCELLED row succeeds', async () => {
      const prisma = app.get(PrismaService);
      const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const end = new Date(start.getTime() + 30 * 60 * 1000);

      await prisma.appointment.create({
        data: {
          patientId: patientAId,
          doctorId,
          startsAt: start,
          endsAt: end,
          reason: 'First booking, later cancelled',
          status: 'CANCELLED',
        },
      });

      await expect(
        prisma.$executeRaw`
          INSERT INTO appointments (id, patient_id, doctor_id, starts_at, ends_at, reason, status, created_at, updated_at)
          VALUES (gen_random_uuid(), ${patientBId}::UUID, ${doctorId}::UUID, ${start}, ${end}, 'Overlaps only a cancelled row', 'BOOKED', now(), now())
        `,
      ).resolves.toBe(1);
    });
  });
});
