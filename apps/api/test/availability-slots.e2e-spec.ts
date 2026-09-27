import { afterEach, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './support/test-app.js';
import { resetDatabase } from './support/reset-db.js';
import { registerDoctor, registerPatient } from './support/auth-helpers.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { AccountStatus, VerificationStatus } from '../src/generated/prisma/enums.js';

function nextWeekday(weekday1to7: number): Date {
  // ISO weekday: Monday = 1 ... Sunday = 7.
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 1);
  while (isoWeekday(date) !== weekday1to7) {
    date.setUTCDate(date.getUTCDate() + 1);
  }
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function isoWeekday(date: Date): number {
  const day = date.getUTCDay();
  return day === 0 ? 7 : day;
}

async function approveDoctor(app: INestApplication, doctorId: string): Promise<void> {
  const prisma = app.get(PrismaService);
  await prisma.doctorProfile.update({
    where: { userId: doctorId },
    data: { verificationStatus: VerificationStatus.APPROVED },
  });
}

describe('Doctor slots', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await resetDatabase();
  });

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it("Patient views an approved doctor's slots", async () => {
    const doctor = await registerDoctor(app);
    await approveDoctor(app, doctor.id);
    await doctor.agent
      .put('/api/doctors/me/availability')
      .send({ timezone: 'UTC', rules: [{ weekday: 1, startMinute: 9 * 60, endMinute: 10 * 60 }] })
      .expect(200);

    const monday = nextWeekday(1);
    const from = monday.toISOString();
    const to = new Date(monday.getTime() + 24 * 60 * 60 * 1000).toISOString();

    const patient = await registerPatient(app);
    const res = await patient.agent.get(`/api/doctors/${doctor.id}/slots`).query({ from, to });

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toMatchObject({ start: expect.any(String), end: expect.any(String) });
  });

  it('Unapproved doctor hidden', async () => {
    const pendingDoctor = await registerDoctor(app);
    const patient = await registerPatient(app);
    const from = new Date().toISOString();
    const to = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const pendingRes = await patient.agent
      .get(`/api/doctors/${pendingDoctor.id}/slots`)
      .query({ from, to });
    expect(pendingRes.status).toBe(404);

    const rejectedDoctor = await registerDoctor(app);
    const prisma = app.get(PrismaService);
    await prisma.doctorProfile.update({
      where: { userId: rejectedDoctor.id },
      data: { verificationStatus: VerificationStatus.REJECTED },
    });
    const rejectedRes = await patient.agent
      .get(`/api/doctors/${rejectedDoctor.id}/slots`)
      .query({ from, to });
    expect(rejectedRes.status).toBe(404);

    // An ID that belongs to a non-doctor account.
    const notADoctorRes = await patient.agent
      .get(`/api/doctors/${patient.id}/slots`)
      .query({ from, to });
    expect(notADoctorRes.status).toBe(404);
  });

  it("Suspended approved doctor's slots return 404", async () => {
    const doctor = await registerDoctor(app);
    await approveDoctor(app, doctor.id);
    await doctor.agent
      .put('/api/doctors/me/availability')
      .send({ timezone: 'UTC', rules: [{ weekday: 1, startMinute: 9 * 60, endMinute: 10 * 60 }] })
      .expect(200);

    const prisma = app.get(PrismaService);
    await prisma.user.update({ where: { id: doctor.id }, data: { status: AccountStatus.SUSPENDED } });

    const monday = nextWeekday(1);
    const from = monday.toISOString();
    const to = new Date(monday.getTime() + 24 * 60 * 60 * 1000).toISOString();

    const patient = await registerPatient(app);
    const res = await patient.agent.get(`/api/doctors/${doctor.id}/slots`).query({ from, to });
    expect(res.status).toBe(404);
  });

  it('Doctor previews own slots while pending', async () => {
    const doctor = await registerDoctor(app);
    await doctor.agent
      .put('/api/doctors/me/availability')
      .send({ timezone: 'UTC', rules: [{ weekday: 1, startMinute: 9 * 60, endMinute: 10 * 60 }] })
      .expect(200);

    const monday = nextWeekday(1);
    const from = monday.toISOString();
    const to = new Date(monday.getTime() + 24 * 60 * 60 * 1000).toISOString();

    const res = await doctor.agent.get(`/api/doctors/${doctor.id}/slots`).query({ from, to });
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it('Slots hidden while not accepting bookings', async () => {
    const doctor = await registerDoctor(app);
    await approveDoctor(app, doctor.id);
    await doctor.agent
      .put('/api/doctors/me/availability')
      .send({ timezone: 'UTC', rules: [{ weekday: 1, startMinute: 9 * 60, endMinute: 10 * 60 }] })
      .expect(200);
    await doctor.agent.patch('/api/doctors/me/profile').send({ acceptingBookings: false }).expect(200);

    const monday = nextWeekday(1);
    const from = monday.toISOString();
    const to = new Date(monday.getTime() + 24 * 60 * 60 * 1000).toISOString();

    const patient = await registerPatient(app);
    const res = await patient.agent.get(`/api/doctors/${doctor.id}/slots`).query({ from, to });
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('Doctor still previews own slots while not accepting bookings', async () => {
    const doctor = await registerDoctor(app);
    await doctor.agent
      .put('/api/doctors/me/availability')
      .send({ timezone: 'UTC', rules: [{ weekday: 1, startMinute: 9 * 60, endMinute: 10 * 60 }] })
      .expect(200);
    await doctor.agent.patch('/api/doctors/me/profile').send({ acceptingBookings: false }).expect(200);

    const monday = nextWeekday(1);
    const from = monday.toISOString();
    const to = new Date(monday.getTime() + 24 * 60 * 60 * 1000).toISOString();

    const res = await doctor.agent.get(`/api/doctors/${doctor.id}/slots`).query({ from, to });
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it('Signed-out denied (slots)', async () => {
    const doctor = await registerDoctor(app);
    const from = new Date().toISOString();
    const to = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const res = await request(app.getHttpServer())
      .get(`/api/doctors/${doctor.id}/slots`)
      .query({ from, to });
    expect(res.status).toBe(401);
  });

  it('Invalid range', async () => {
    const doctor = await registerDoctor(app);

    const tooLong = await doctor.agent.get(`/api/doctors/${doctor.id}/slots`).query({
      from: new Date().toISOString(),
      to: new Date(Date.now() + 32 * 24 * 60 * 60 * 1000).toISOString(),
    });
    expect(tooLong.status).toBe(400);

    const backwards = await doctor.agent.get(`/api/doctors/${doctor.id}/slots`).query({
      from: new Date().toISOString(),
      to: new Date(Date.now() - 60_000).toISOString(),
    });
    expect(backwards.status).toBe(400);
  });

  it('Schedule changes apply immediately', async () => {
    const doctor = await registerDoctor(app);
    await approveDoctor(app, doctor.id);
    await doctor.agent
      .put('/api/doctors/me/availability')
      .send({ timezone: 'UTC', rules: [{ weekday: 1, startMinute: 9 * 60, endMinute: 10 * 60 }] })
      .expect(200);

    const monday = nextWeekday(1);
    const from = monday.toISOString();
    const to = new Date(monday.getTime() + 24 * 60 * 60 * 1000).toISOString();

    const before = await doctor.agent.get(`/api/doctors/${doctor.id}/slots`).query({ from, to });
    expect(before.body).toHaveLength(2);

    await doctor.agent
      .put('/api/doctors/me/availability')
      .send({ timezone: 'UTC', rules: [{ weekday: 1, startMinute: 9 * 60, endMinute: 12 * 60 }] })
      .expect(200);

    const after = await doctor.agent.get(`/api/doctors/${doctor.id}/slots`).query({ from, to });
    expect(after.body).toHaveLength(6);
  });
});
