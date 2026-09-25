import { afterEach, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './support/test-app.js';
import { resetDatabase } from './support/reset-db.js';
import { registerDoctor, registerPatient } from './support/auth-helpers.js';

describe('Doctor profile', () => {
  let app: INestApplication;
  let specializationIds: string[];

  beforeAll(async () => {
    await resetDatabase();
    const bootstrapApp = await createTestApp();
    const list = await request(bootstrapApp.getHttpServer()).get('/api/specializations').expect(200);
    specializationIds = list.body.map((s: { id: string }) => s.id);
    await bootstrapApp.close();
  });

  function spec(index: number): string {
    const id = specializationIds[index];
    if (!id) throw new Error(`No specialization at index ${index}`);
    return id;
  }

  // A fresh app per test isolates each test's registration rate-limit counter
  // (the registration endpoint is limited to 5/minute/IP).
  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('Doctor views profile', async () => {
    const doctor = await registerDoctor(app, {
      firstName: 'Grace',
      lastName: 'Hopper',
      specializationIds: [spec(0)],
    });

    const res = await doctor.agent.get('/api/doctors/me/profile');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      firstName: 'Grace',
      lastName: 'Hopper',
      verificationStatus: 'PENDING',
    });
    expect(res.body.specializations).toHaveLength(1);
    expect(res.body.specializations[0]).toMatchObject({ id: spec(0) });
  });

  it('Non-doctor denied', async () => {
    const patient = await registerPatient(app);
    const res = await patient.agent.get('/api/doctors/me/profile');
    expect(res.status).toBe(403);
  });

  it('Signed-out denied', async () => {
    const res = await request(app.getHttpServer()).get('/api/doctors/me/profile');
    expect(res.status).toBe(401);
  });

  it('Valid update', async () => {
    const doctor = await registerDoctor(app, { specializationIds: [spec(0)] });

    const res = await doctor.agent
      .patch('/api/doctors/me/profile')
      .send({ bio: 'Updated bio', specializationIds: [spec(0), spec(1)] });

    expect(res.status).toBe(200);
    expect(res.body.bio).toBe('Updated bio');
    expect(res.body.specializations).toHaveLength(2);
  });

  it('Invalid values', async () => {
    const doctor = await registerDoctor(app, { specializationIds: [spec(0)] });

    const emptySpecializations = await doctor.agent
      .patch('/api/doctors/me/profile')
      .send({ specializationIds: [] });
    const badConsultationLength = await doctor.agent
      .patch('/api/doctors/me/profile')
      .send({ consultationMinutes: 25 });

    expect(emptySpecializations.status).toBe(400);
    expect(badConsultationLength.status).toBe(400);
  });

  it('Cannot self-verify', async () => {
    const doctor = await registerDoctor(app, { specializationIds: [spec(0)] });

    const res = await doctor.agent
      .patch('/api/doctors/me/profile')
      .send({ verificationStatus: 'APPROVED', reviewNote: 'self-approved' });

    expect(res.status).toBe(400);

    const profile = await doctor.agent.get('/api/doctors/me/profile');
    expect(profile.body.verificationStatus).toBe('PENDING');
  });

  it('Duplicate license number', async () => {
    const licenseNumber = `LIC-DUP-${Date.now()}`;
    await registerDoctor(app, { specializationIds: [spec(0)], licenseNumber });
    const other = await registerDoctor(app, { specializationIds: [spec(0)] });

    const res = await other.agent.patch('/api/doctors/me/profile').send({ licenseNumber });

    expect(res.status).toBe(409);
  });
});
