import { afterEach, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './support/test-app.js';
import { resetDatabase } from './support/reset-db.js';
import { registerDoctor, registerPatient, createAndSignInAdmin } from './support/auth-helpers.js';

describe('Doctor weekly schedule', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await resetDatabase();
  });

  // A fresh app per test isolates each test's registration rate-limit counter.
  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('Save a valid schedule', async () => {
    const doctor = await registerDoctor(app);

    const res = await doctor.agent.put('/api/doctors/me/availability').send({
      timezone: 'Asia/Manila',
      rules: [
        { weekday: 1, startMinute: 9 * 60, endMinute: 12 * 60 },
        { weekday: 1, startMinute: 13 * 60, endMinute: 17 * 60 },
      ],
    });

    expect(res.status).toBe(200);
    expect(res.body.timezone).toBe('Asia/Manila');
    expect(res.body.rules).toEqual([
      { weekday: 1, startMinute: 9 * 60, endMinute: 12 * 60 },
      { weekday: 1, startMinute: 13 * 60, endMinute: 17 * 60 },
    ]);

    // Replaces any previous schedule, in full.
    const replaced = await doctor.agent.put('/api/doctors/me/availability').send({
      timezone: 'Asia/Manila',
      rules: [{ weekday: 2, startMinute: 10 * 60, endMinute: 11 * 60 }],
    });
    expect(replaced.status).toBe(200);
    expect(replaced.body.rules).toEqual([{ weekday: 2, startMinute: 10 * 60, endMinute: 11 * 60 }]);
  });

  it('An empty rule list is allowed', async () => {
    const doctor = await registerDoctor(app);
    const res = await doctor.agent
      .put('/api/doctors/me/availability')
      .send({ timezone: 'UTC', rules: [] });
    expect(res.status).toBe(200);
    expect(res.body.rules).toEqual([]);
  });

  it('Overlapping ranges', async () => {
    const doctor = await registerDoctor(app);
    await doctor.agent
      .put('/api/doctors/me/availability')
      .send({ timezone: 'UTC', rules: [{ weekday: 1, startMinute: 9 * 60, endMinute: 12 * 60 }] })
      .expect(200);

    const res = await doctor.agent.put('/api/doctors/me/availability').send({
      timezone: 'UTC',
      rules: [
        { weekday: 1, startMinute: 9 * 60, endMinute: 12 * 60 },
        { weekday: 1, startMinute: 11 * 60, endMinute: 14 * 60 },
      ],
    });

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual([
      { field: 'rules[0]', message: expect.any(String) },
      { field: 'rules[1]', message: expect.any(String) },
    ]);

    const unchanged = await doctor.agent.get('/api/doctors/me/availability');
    expect(unchanged.body.rules).toEqual([{ weekday: 1, startMinute: 9 * 60, endMinute: 12 * 60 }]);
  });

  it('End not after start', async () => {
    const doctor = await registerDoctor(app);

    const reversed = await doctor.agent
      .put('/api/doctors/me/availability')
      .send({ timezone: 'UTC', rules: [{ weekday: 1, startMinute: 14 * 60, endMinute: 13 * 60 }] });
    expect(reversed.status).toBe(400);

    const offStep = await doctor.agent
      .put('/api/doctors/me/availability')
      .send({ timezone: 'UTC', rules: [{ weekday: 1, startMinute: 9 * 60 + 5, endMinute: 12 * 60 }] });
    expect(offStep.status).toBe(400);

    const unchanged = await doctor.agent.get('/api/doctors/me/availability');
    expect(unchanged.body.rules).toEqual([]);
  });

  it('Range shorter than consultation', async () => {
    const doctor = await registerDoctor(app);
    await doctor.agent.patch('/api/doctors/me/profile').send({ consultationMinutes: 45 }).expect(200);

    const res = await doctor.agent.put('/api/doctors/me/availability').send({
      timezone: 'UTC',
      rules: [{ weekday: 1, startMinute: 9 * 60, endMinute: 9 * 60 + 30 }],
    });

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual([{ field: 'rules[0]', message: expect.stringMatching(/shorter than one consultation/i) }]);
  });

  it('Invalid time zone', async () => {
    const doctor = await registerDoctor(app);

    const res = await doctor.agent
      .put('/api/doctors/me/availability')
      .send({ timezone: 'Mars/Olympus', rules: [] });

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual([{ field: 'timezone', message: expect.any(String) }]);
  });

  it('Non-doctor denied', async () => {
    const patient = await registerPatient(app);
    const admin = await createAndSignInAdmin(app);

    const patientRes = await patient.agent.get('/api/doctors/me/availability');
    expect(patientRes.status).toBe(403);

    const adminRes = await admin.agent
      .put('/api/doctors/me/availability')
      .send({ timezone: 'UTC', rules: [] });
    expect(adminRes.status).toBe(403);
  });

  it('Signed-out denied (availability)', async () => {
    const getRes = await request(app.getHttpServer()).get('/api/doctors/me/availability');
    expect(getRes.status).toBe(401);

    const putRes = await request(app.getHttpServer())
      .put('/api/doctors/me/availability')
      .send({ timezone: 'UTC', rules: [] });
    expect(putRes.status).toBe(401);
  });

  it('Doctor views availability', async () => {
    const doctor = await registerDoctor(app);
    await doctor.agent
      .put('/api/doctors/me/availability')
      .send({ timezone: 'Asia/Manila', rules: [{ weekday: 3, startMinute: 9 * 60, endMinute: 10 * 60 }] })
      .expect(200);

    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await doctor.agent
      .post('/api/doctors/me/availability/exceptions')
      .send({
        startsAt: future.toISOString(),
        endsAt: new Date(future.getTime() + 60 * 60 * 1000).toISOString(),
        reason: 'Conference',
      })
      .expect(201);

    const res = await doctor.agent.get('/api/doctors/me/availability');
    expect(res.status).toBe(200);
    expect(res.body.timezone).toBe('Asia/Manila');
    expect(res.body.rules).toEqual([{ weekday: 3, startMinute: 9 * 60, endMinute: 10 * 60 }]);
    expect(res.body.timeOff).toHaveLength(1);
    expect(res.body.timeOff[0]).toMatchObject({ reason: 'Conference' });
  });

  it('New doctor', async () => {
    const doctor = await registerDoctor(app);
    const res = await doctor.agent.get('/api/doctors/me/availability');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ timezone: 'UTC', rules: [], timeOff: [] });
  });
});
