import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './support/test-app.js';
import { resetDatabase } from './support/reset-db.js';
import { createAndSignInAdmin, type RegisteredUser } from './support/auth-helpers.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { Role, VerificationStatus, AccountStatus } from '../src/generated/prisma/enums.js';
import {
  DEMO_DOMAIN,
  DEMO_PASSWORD,
  PRIMARY_DOCTOR_EMAIL,
  PRIMARY_PATIENT_EMAIL,
  resetDemoData,
  seedDemoData,
  stageLiveConsultation,
} from '../scripts/seed-demo.js';

/**
 * Exercises `seed-demo.ts` directly (bypassing the Docker entrypoint's `DEMO_DATA` shell check,
 * which is a one-line conditional verified by hand — see design.md) against the real test
 * database, through the actual HTTP API where the spec's scenario is phrased in terms of what a
 * signed-in user sees.
 */
describe('Demo dataset', () => {
  let app: INestApplication;
  let admin: RegisteredUser;
  let patient: RegisteredUser;

  beforeAll(async () => {
    await resetDatabase();
    app = await createTestApp();
    admin = await createAndSignInAdmin(app);
    await seedDemoData();

    const agent = request.agent(app.getHttpServer());
    await agent.post('/api/auth/login').send({ email: PRIMARY_PATIENT_EMAIL, password: DEMO_PASSWORD }).expect(200);
    patient = { agent, email: PRIMARY_PATIENT_EMAIL, password: DEMO_PASSWORD, id: '', token: '' };
  });

  afterAll(async () => {
    await app.close();
  });

  it('First startup loads demo data', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: PRIMARY_PATIENT_EMAIL, password: DEMO_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('PATIENT');
  });

  it('Restart leaves demo data unchanged', async () => {
    const prisma = app.get(PrismaService);
    const usersBefore = await prisma.user.count();
    const appointmentsBefore = await prisma.appointment.count();

    await seedDemoData();

    expect(await prisma.user.count()).toBe(usersBefore);
    expect(await prisma.appointment.count()).toBe(appointmentsBefore);
  });

  it('Doctor search is populated', async () => {
    const res = await patient.agent.get('/api/doctors').query({ pageSize: 50 }).expect(200);
    expect(res.body.total).toBeGreaterThanOrEqual(8);

    const items = res.body.items as { nextAvailableSlot: string | null }[];
    const withinTwoWeeks = Date.now() + 14 * 24 * 60 * 60 * 1000;
    const soon = items.filter((d) => d.nextAvailableSlot !== null && new Date(d.nextAvailableSlot).getTime() <= withinTwoWeeks);
    expect(soon.length).toBeGreaterThanOrEqual(Math.ceil(items.length / 2));
  });

  it('Records are populated', async () => {
    const res = await patient.agent.get('/api/records').expect(200);
    expect(res.body.items.length).toBeGreaterThanOrEqual(2);
    for (const item of res.body.items as { patientSummary: string | null }[]) {
      expect(item.patientSummary).toBeTruthy();
    }

    const detail = await patient.agent.get(`/api/records/${res.body.items[0].appointmentId}`).expect(200);
    expect(detail.body.note).not.toBeNull();
    expect(detail.body.prescriptions.length).toBeGreaterThanOrEqual(1);
  });

  it('Admin has work to do', async () => {
    const res = await admin.agent.get('/api/admin/dashboard').expect(200);
    expect(res.body.pendingDoctorReviews).toBeGreaterThanOrEqual(1);
    expect(res.body.invalidBookings).toBeGreaterThanOrEqual(1);
  });

  it('Seed invariants hold', async () => {
    const prisma = app.get(PrismaService);

    const approvedDoctors = await prisma.doctorProfile.findMany({
      where: { verificationStatus: VerificationStatus.APPROVED, user: { email: { endsWith: `@${DEMO_DOMAIN}` } } },
      include: { specializations: true },
    });
    expect(approvedDoctors.length).toBeGreaterThanOrEqual(8);
    const specializationIds = new Set(approvedDoctors.flatMap((d) => d.specializations.map((s) => s.specializationId)));
    expect(specializationIds.size).toBeGreaterThanOrEqual(8);

    expect(await prisma.doctorProfile.count({ where: { verificationStatus: VerificationStatus.PENDING } })).toBeGreaterThanOrEqual(1);
    expect(await prisma.doctorProfile.count({ where: { verificationStatus: VerificationStatus.REJECTED } })).toBeGreaterThanOrEqual(1);
    expect(
      await prisma.user.count({ where: { role: Role.DOCTOR, status: AccountStatus.SUSPENDED } }),
    ).toBeGreaterThanOrEqual(1);
    expect(
      await prisma.user.count({ where: { role: Role.PATIENT, status: AccountStatus.SUSPENDED } }),
    ).toBeGreaterThanOrEqual(1);

    // The exclusion constraint (see appointment-constraints.e2e-spec.ts) still holds for seeded
    // data: no two BOOKED rows for the same doctor overlap in time.
    const booked = await prisma.appointment.findMany({
      where: { status: 'BOOKED' },
      select: { doctorId: true, patientId: true, startsAt: true, endsAt: true },
      orderBy: { startsAt: 'asc' },
    });
    const byDoctor = new Map<string, typeof booked>();
    for (const row of booked) {
      byDoctor.set(row.doctorId, [...(byDoctor.get(row.doctorId) ?? []), row]);
    }
    for (const rows of byDoctor.values()) {
      for (let i = 1; i < rows.length; i++) {
        expect(rows[i]!.startsAt.getTime()).toBeGreaterThanOrEqual(rows[i - 1]!.endsAt.getTime());
      }
    }
  });
});

describe('Demo dataset disabled', () => {
  it('Disabled', async () => {
    await resetDatabase();
    const app = await createTestApp();
    await createAndSignInAdmin(app);

    const prisma = app.get(PrismaService);
    // Only the administrator this test itself created (via createAndSignInAdmin, standing in for
    // the entrypoint's provision-admin step) exists — no demo accounts, since seedDemoData() was
    // never called (the entrypoint's `DEMO_DATA` shell check gates that call; see docker-entrypoint.sh).
    expect(await prisma.user.count({ where: { role: { not: Role.ADMIN } } })).toBe(0);

    await app.close();
  });
});

describe('Live consultation command', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await resetDatabase();
    app = await createTestApp();
    await createAndSignInAdmin(app);
    await seedDemoData();
  });

  afterAll(async () => {
    await app.close();
  });

  it('Stage a live consultation', async () => {
    await stageLiveConsultation();

    const prisma = app.get(PrismaService);
    const patient = await prisma.user.findUniqueOrThrow({ where: { email: PRIMARY_PATIENT_EMAIL } });
    const doctor = await prisma.user.findUniqueOrThrow({ where: { email: PRIMARY_DOCTOR_EMAIL } });
    const staged = await prisma.appointment.findFirst({
      where: { patientId: patient.id, doctorId: doctor.id, reason: { startsWith: '[demo-live]' } },
    });
    expect(staged).not.toBeNull();
    expect(staged!.status).toBe('BOOKED');
    const minutesUntilStart = (staged!.startsAt.getTime() - Date.now()) / 60_000;
    expect(minutesUntilStart).toBeGreaterThan(0);
    expect(minutesUntilStart).toBeLessThan(15);
  });

  it('Run twice', async () => {
    const prisma = app.get(PrismaService);
    const totalBefore = await prisma.appointment.count();

    await stageLiveConsultation();
    await stageLiveConsultation();

    const patient = await prisma.user.findUniqueOrThrow({ where: { email: PRIMARY_PATIENT_EMAIL } });
    const doctor = await prisma.user.findUniqueOrThrow({ where: { email: PRIMARY_DOCTOR_EMAIL } });
    const staged = await prisma.appointment.findMany({
      where: { patientId: patient.id, doctorId: doctor.id, reason: { startsWith: '[demo-live]' } },
    });
    expect(staged.length).toBe(1);
    // Running it again only replaces the one staged appointment; nothing else is touched.
    expect(await prisma.appointment.count()).toBe(totalBefore);
  });
});

describe('Demo data reset', () => {
  it('Reset keeps real data', async () => {
    await resetDatabase();
    const app = await createTestApp();
    await createAndSignInAdmin(app);
    await seedDemoData();

    const prisma = app.get(PrismaService);
    const realDoctor = await prisma.user.create({
      data: {
        email: 'real.doctor@example.com',
        passwordHash: 'x',
        role: Role.DOCTOR,
        doctorProfile: { create: { firstName: 'Real', lastName: 'Doctor', licenseNumber: 'REAL-0001' } },
      },
    });
    const realPatient = await prisma.user.create({
      data: {
        email: 'real.patient@example.com',
        passwordHash: 'x',
        role: Role.PATIENT,
        patientProfile: { create: { firstName: 'Real', lastName: 'Patient' } },
      },
    });
    const realAppointment = await prisma.appointment.create({
      data: {
        patientId: realPatient.id,
        doctorId: realDoctor.id,
        startsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        endsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 30 * 60_000),
        reason: 'Real appointment between two non-demo accounts',
      },
    });

    await resetDemoData();

    expect(await prisma.user.count({ where: { email: { endsWith: `@${DEMO_DOMAIN}` } } })).toBe(0);
    expect(await prisma.user.findUnique({ where: { id: realPatient.id } })).not.toBeNull();
    expect(await prisma.user.findUnique({ where: { id: realDoctor.id } })).not.toBeNull();
    expect(await prisma.appointment.findUnique({ where: { id: realAppointment.id } })).not.toBeNull();

    await app.close();
  });
});
