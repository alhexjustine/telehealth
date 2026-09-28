import { afterEach, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './support/test-app.js';
import { resetDatabase } from './support/reset-db.js';
import { createAndSignInAdmin } from './support/auth-helpers.js';
import { registerBookableDoctor, registerBookablePatient } from './support/appointment-helpers.js';

function slotDaysOut(days: number): Date {
  const target = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const stepMs = 30 * 60_000;
  return new Date(Math.ceil(target.getTime() / stepMs) * stepMs);
}

describe('List and view appointments', () => {
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

  it('Patient lists upcoming', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);

    const first = await patient.agent
      .post('/api/appointments')
      .send({ doctorId: doctor.id, startsAt: slotDaysOut(1).toISOString(), reason: 'Sooner of the two upcoming' })
      .expect(201);
    const second = await patient.agent
      .post('/api/appointments')
      .send({ doctorId: doctor.id, startsAt: slotDaysOut(2).toISOString(), reason: 'Later of the two upcoming' })
      .expect(201);
    const cancelled = await patient.agent
      .post('/api/appointments')
      .send({ doctorId: doctor.id, startsAt: slotDaysOut(3).toISOString(), reason: 'Will be cancelled' })
      .expect(201);
    await patient.agent.post(`/api/appointments/${cancelled.body.id}/cancel`).send({}).expect(200);

    const res = await patient.agent.get('/api/appointments').query({ scope: 'upcoming' });

    expect(res.status).toBe(200);
    expect(res.body.items.map((i: { id: string }) => i.id)).toEqual([first.body.id, second.body.id]);
    expect(res.body.total).toBe(2);
  });

  it('Doctor lists past', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);

    const booked = await patient.agent
      .post('/api/appointments')
      .send({ doctorId: doctor.id, startsAt: slotDaysOut(1).toISOString(), reason: 'Will become a past appointment' })
      .expect(201);
    await patient.agent.post(`/api/appointments/${booked.body.id}/cancel`).send({}).expect(200);

    const res = await doctor.agent.get('/api/appointments').query({ scope: 'past' });

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({
      id: booked.body.id,
      patient: expect.objectContaining({ displayName: expect.any(String), age: expect.any(Number) }),
      reason: 'Will become a past appointment',
    });
  });

  it('Participant views details', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const booked = await patient.agent
      .post('/api/appointments')
      .send({ doctorId: doctor.id, startsAt: slotDaysOut(1).toISOString(), reason: 'Viewed by both participants' })
      .expect(201);

    const patientView = await patient.agent.get(`/api/appointments/${booked.body.id}`);
    expect(patientView.status).toBe(200);
    expect(patientView.body.doctor.id).toBe(doctor.id);
    expect(patientView.body.dependent).toBeNull();
    expect(patientView.body.history).toEqual([expect.objectContaining({ id: booked.body.id })]);

    const doctorView = await doctor.agent.get(`/api/appointments/${booked.body.id}`);
    expect(doctorView.status).toBe(200);
    expect(doctorView.body.patient.id).toBe(patient.id);
    expect(doctorView.body.dependent).toBeNull();
  });

  it('Non-participant denied', async () => {
    const doctor = await registerBookableDoctor(app);
    const otherDoctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const otherPatient = await registerBookablePatient(app);
    const booked = await patient.agent
      .post('/api/appointments')
      .send({ doctorId: doctor.id, startsAt: slotDaysOut(1).toISOString(), reason: 'Only visible to its participants' })
      .expect(201);

    const otherPatientRes = await otherPatient.agent.get(`/api/appointments/${booked.body.id}`);
    expect(otherPatientRes.status).toBe(404);

    const otherDoctorRes = await otherDoctor.agent.get(`/api/appointments/${booked.body.id}`);
    expect(otherDoctorRes.status).toBe(404);
  });

  it('Signed-out denied (appointments)', async () => {
    const listRes = await request(app.getHttpServer()).get('/api/appointments').query({ scope: 'upcoming' });
    expect(listRes.status).toBe(401);

    const detailRes = await request(app.getHttpServer()).get(
      '/api/appointments/00000000-0000-4000-8000-000000000000',
    );
    expect(detailRes.status).toBe(401);
  });

  it('Admin denied on the list endpoint', async () => {
    const admin = await createAndSignInAdmin(app);
    const res = await admin.agent.get('/api/appointments').query({ scope: 'upcoming' });
    expect(res.status).toBe(403);
  });
});
