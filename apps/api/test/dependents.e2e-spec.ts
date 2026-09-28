import { afterEach, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './support/test-app.js';
import { resetDatabase } from './support/reset-db.js';
import { createAndSignInAdmin, registerDoctor, registerPatient } from './support/auth-helpers.js';

describe('Patient dependents', () => {
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

  it('Successful add', async () => {
    const patient = await registerPatient(app);

    const res = await patient.agent
      .post('/api/patients/me/dependents')
      .send({ firstName: 'Jamie', lastName: 'Lovelace', birthDate: '2018-06-15', relationship: 'CHILD' })
      .expect(201);

    expect(res.body).toMatchObject({
      firstName: 'Jamie',
      lastName: 'Lovelace',
      birthDate: '2018-06-15',
      relationship: 'CHILD',
      medicalConditions: null,
      allergies: null,
      currentMedications: null,
    });
    expect(typeof res.body.id).toBe('string');
  });

  it('Missing required field', async () => {
    const patient = await registerPatient(app);

    await patient.agent
      .post('/api/patients/me/dependents')
      .send({ firstName: 'Jamie', lastName: 'Lovelace', relationship: 'CHILD' })
      .expect(400);

    await patient.agent
      .post('/api/patients/me/dependents')
      .send({ firstName: 'Jamie', lastName: 'Lovelace', birthDate: '2018-06-15' })
      .expect(400);

    const list = await patient.agent.get('/api/patients/me/dependents').expect(200);
    expect(list.body.items).toHaveLength(0);
  });

  it('Future birthdate', async () => {
    const patient = await registerPatient(app);
    const futureDate = new Date(Date.now() + 365 * 24 * 3_600_000).toISOString().slice(0, 10);

    await patient.agent
      .post('/api/patients/me/dependents')
      .send({ firstName: 'Jamie', lastName: 'Lovelace', birthDate: futureDate, relationship: 'CHILD' })
      .expect(400);

    const list = await patient.agent.get('/api/patients/me/dependents').expect(200);
    expect(list.body.items).toHaveLength(0);
  });

  it('Too many dependents', async () => {
    const patient = await registerPatient(app);
    for (let i = 0; i < 10; i += 1) {
      await patient.agent
        .post('/api/patients/me/dependents')
        .send({ firstName: `Dependent${i}`, lastName: 'Lovelace', birthDate: '2018-06-15', relationship: 'CHILD' })
        .expect(201);
    }

    const res = await patient.agent
      .post('/api/patients/me/dependents')
      .send({ firstName: 'Eleventh', lastName: 'Lovelace', birthDate: '2018-06-15', relationship: 'CHILD' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('DEPENDENT_LIMIT_REACHED');
  });

  it('Signed-out denied', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/patients/me/dependents')
      .send({ firstName: 'Jamie', lastName: 'Lovelace', birthDate: '2018-06-15', relationship: 'CHILD' });
    expect(res.status).toBe(401);
  });

  it('Non-patient denied', async () => {
    const doctor = await registerDoctor(app);
    const admin = await createAndSignInAdmin(app);

    await doctor.agent
      .post('/api/patients/me/dependents')
      .send({ firstName: 'Jamie', lastName: 'Lovelace', birthDate: '2018-06-15', relationship: 'CHILD' })
      .expect(403);
    await admin.agent
      .post('/api/patients/me/dependents')
      .send({ firstName: 'Jamie', lastName: 'Lovelace', birthDate: '2018-06-15', relationship: 'CHILD' })
      .expect(403);
  });

  it('List own dependents', async () => {
    const patient = await registerPatient(app);
    await patient.agent
      .post('/api/patients/me/dependents')
      .send({ firstName: 'Jamie', lastName: 'Lovelace', birthDate: '2018-06-15', relationship: 'CHILD' })
      .expect(201);
    await patient.agent
      .post('/api/patients/me/dependents')
      .send({ firstName: 'Sam', lastName: 'Lovelace', birthDate: '1960-01-01', relationship: 'PARENT' })
      .expect(201);

    const res = await patient.agent.get('/api/patients/me/dependents').expect(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items.map((d: { firstName: string }) => d.firstName)).toEqual(['Jamie', 'Sam']);
  });

  it('Update fields', async () => {
    const patient = await registerPatient(app);
    const created = await patient.agent
      .post('/api/patients/me/dependents')
      .send({ firstName: 'Jamie', lastName: 'Lovelace', birthDate: '2018-06-15', relationship: 'CHILD' })
      .expect(201);

    const res = await patient.agent
      .patch(`/api/patients/me/dependents/${created.body.id as string}`)
      .send({ allergies: 'Peanuts' })
      .expect(200);

    expect(res.body.allergies).toBe('Peanuts');
    expect(res.body.firstName).toBe('Jamie');
  });

  it('Another account\'s dependent', async () => {
    const patient = await registerPatient(app);
    const otherPatient = await registerPatient(app);
    const created = await patient.agent
      .post('/api/patients/me/dependents')
      .send({ firstName: 'Jamie', lastName: 'Lovelace', birthDate: '2018-06-15', relationship: 'CHILD' })
      .expect(201);

    await otherPatient.agent.get(`/api/patients/me/dependents/${created.body.id as string}`).expect(404);
    await otherPatient.agent
      .patch(`/api/patients/me/dependents/${created.body.id as string}`)
      .send({ allergies: 'Peanuts' })
      .expect(404);
  });

  it('Remove a dependent', async () => {
    const patient = await registerPatient(app);
    const created = await patient.agent
      .post('/api/patients/me/dependents')
      .send({ firstName: 'Jamie', lastName: 'Lovelace', birthDate: '2018-06-15', relationship: 'CHILD' })
      .expect(201);

    await patient.agent.delete(`/api/patients/me/dependents/${created.body.id as string}`).expect(200);

    const list = await patient.agent.get('/api/patients/me/dependents').expect(200);
    expect(list.body.items).toHaveLength(0);
  });

  it('Already removed', async () => {
    const patient = await registerPatient(app);
    const otherPatient = await registerPatient(app);
    const created = await patient.agent
      .post('/api/patients/me/dependents')
      .send({ firstName: 'Jamie', lastName: 'Lovelace', birthDate: '2018-06-15', relationship: 'CHILD' })
      .expect(201);

    await patient.agent.delete(`/api/patients/me/dependents/${created.body.id as string}`).expect(200);
    await patient.agent.delete(`/api/patients/me/dependents/${created.body.id as string}`).expect(404);
    await otherPatient.agent.delete(`/api/patients/me/dependents/${created.body.id as string}`).expect(404);
  });
});
