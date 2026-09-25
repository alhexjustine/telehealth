import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './support/test-app.js';
import { resetDatabase } from './support/reset-db.js';
import { registerDoctor, registerPatient } from './support/auth-helpers.js';

describe('Current user', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await resetDatabase();
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('Signed-in patient', async () => {
    const patient = await registerPatient(app, { firstName: 'Ada', lastName: 'Lovelace' });

    const res = await patient.agent.get('/api/auth/me');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ role: 'PATIENT', displayName: 'Ada Lovelace', profileComplete: false });
  });

  it('Signed-in doctor', async () => {
    const doctor = await registerDoctor(app, { firstName: 'Grace', lastName: 'Hopper' });

    const res = await doctor.agent.get('/api/auth/me');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      role: 'DOCTOR',
      displayName: 'Grace Hopper',
      verificationStatus: 'PENDING',
    });
  });

  it('Not signed in', async () => {
    const res = await request(app.getHttpServer()).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});
