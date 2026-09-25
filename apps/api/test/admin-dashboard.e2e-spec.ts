import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { createTestApp } from './support/test-app.js';
import { resetDatabase } from './support/reset-db.js';
import { createAndSignInAdmin, registerDoctor, registerPatient } from './support/auth-helpers.js';
import { createAppointmentDirect, registerBookableDoctor, registerBookablePatient } from './support/appointment-helpers.js';

describe('Admin dashboard', () => {
  let app: INestApplication;

  beforeEach(async () => {
    await resetDatabase();
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('Counts reflect the data', async () => {
    const admin = await createAndSignInAdmin(app);
    await registerDoctor(app); // pending #1
    await registerDoctor(app); // pending #2
    await registerDoctor(app); // pending #3

    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    // Two invalid bookings: one stale-uncompleted, one with a since-rejected doctor.
    await createAppointmentDirect(app, {
      patientId: patient.id,
      doctorId: doctor.id,
      startsAt: new Date(Date.now() - 3 * 3_600_000),
    });
    const otherDoctor = await registerBookableDoctor(app);
    const otherPatient = await registerBookablePatient(app);
    await createAppointmentDirect(app, {
      patientId: otherPatient.id,
      doctorId: otherDoctor.id,
      startsAt: new Date(Date.now() + 3 * 3_600_000),
    });
    await admin.agent.post(`/api/admin/doctors/${otherDoctor.id}/reject`).send({ note: 'Needs re-verification' }).expect(200);

    const res = await admin.agent.get('/api/admin/dashboard').expect(200);

    expect(res.body.pendingDoctorReviews).toBe(3);
    expect(res.body.invalidBookings).toBe(2);
    expect(res.body.doctors.ACTIVE).toBeGreaterThanOrEqual(1);
  });

  it("Daily buckets in the admin's time zone", async () => {
    const admin = await createAndSignInAdmin(app);
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);

    // 23:30 UTC tomorrow is 07:30 the day after tomorrow in Asia/Manila
    // (UTC+8) — it should land in the *following* day's bucket there.
    const now = new Date();
    const utcDateKey = new Date(now.getTime() + 24 * 3_600_000).toISOString().slice(0, 10);
    const startsAt = new Date(`${utcDateKey}T23:30:00.000Z`);
    const manilaDateKey = new Date(startsAt.getTime() + 24 * 3_600_000).toISOString().slice(0, 10);
    await createAppointmentDirect(app, { patientId: patient.id, doctorId: doctor.id, startsAt });

    const res = await admin.agent.get('/api/admin/dashboard').query({ tz: 'Asia/Manila' }).expect(200);

    const manilaBucket = res.body.trend.find((b: { date: string; count: number }) => b.date === manilaDateKey);
    const utcDateBucket = res.body.trend.find((b: { date: string; count: number }) => b.date === utcDateKey);

    expect(manilaBucket?.count).toBe(1);
    expect(utcDateBucket?.count ?? 0).toBe(0);
  });

  it('Non-admin denied (dashboard)', async () => {
    const patient = await registerPatient(app);
    const doctor = await registerDoctor(app);

    expect((await patient.agent.get('/api/admin/dashboard')).status).toBe(403);
    expect((await doctor.agent.get('/api/admin/dashboard')).status).toBe(403);
  });
});
