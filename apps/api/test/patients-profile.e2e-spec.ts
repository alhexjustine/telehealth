import { afterEach, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './support/test-app.js';
import { resetDatabase } from './support/reset-db.js';
import { registerDoctor, registerPatient } from './support/auth-helpers.js';

describe('Patient profile', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await resetDatabase();
  });

  // A fresh app per test gives each test its own registration rate-limit
  // counter, since several of these tests each need their own registered
  // patient and the registration endpoint is limited to 5/minute/IP.
  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('Patient views profile', async () => {
    const patient = await registerPatient(app, { firstName: 'Ada', lastName: 'Lovelace' });

    const res = await patient.agent.get('/api/patients/me/profile');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      firstName: 'Ada',
      lastName: 'Lovelace',
      birthDate: null,
      weightKg: null,
      heightCm: null,
      phone: null,
      profileComplete: false,
    });
  });

  it('Non-patient denied', async () => {
    const doctor = await registerDoctor(app);
    const res = await doctor.agent.get('/api/patients/me/profile');
    expect(res.status).toBe(403);
  });

  it('Signed-out denied', async () => {
    const res = await request(app.getHttpServer()).get('/api/patients/me/profile');
    expect(res.status).toBe(401);
  });

  it('Valid update', async () => {
    const patient = await registerPatient(app);

    const res = await patient.agent
      .patch('/api/patients/me/profile')
      .send({ phone: '+15551234567', weightKg: 70, heightCm: 175 });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ phone: '+15551234567', weightKg: 70, heightCm: 175 });

    const reread = await patient.agent.get('/api/patients/me/profile');
    expect(reread.body).toMatchObject({ phone: '+15551234567', weightKg: 70, heightCm: 175 });
  });

  it('Out-of-range values', async () => {
    const patient = await registerPatient(app);

    const res = await patient.agent.patch('/api/patients/me/profile').send({
      birthDate: '2099-01-01',
      weightKg: 0,
      heightCm: 400,
    });

    expect(res.status).toBe(400);
  });

  it('Cannot change another patient', async () => {
    const patient = await registerPatient(app);
    const other = await registerPatient(app);

    const res = await patient.agent
      .patch('/api/patients/me/profile')
      .send({ userId: other.id, phone: '+15551234567' });

    expect(res.status).toBe(400);

    const otherProfile = await other.agent.get('/api/patients/me/profile');
    expect(otherProfile.body.phone).toBeNull();
  });

  it('Newly registered patient', async () => {
    const patient = await registerPatient(app);
    const res = await patient.agent.get('/api/patients/me/profile');
    expect(res.body.profileComplete).toBe(false);
  });

  it('Required fields filled', async () => {
    const patient = await registerPatient(app);

    await patient.agent
      .patch('/api/patients/me/profile')
      .send({ birthDate: '1990-01-01', weightKg: 70, heightCm: 175, phone: '+15551234567' })
      .expect(200);

    const res = await patient.agent.get('/api/patients/me/profile');
    expect(res.body.profileComplete).toBe(true);
  });
});
