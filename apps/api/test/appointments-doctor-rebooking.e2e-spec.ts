import { afterEach, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { createTestApp } from './support/test-app.js';
import { resetDatabase } from './support/reset-db.js';
import { registerBookableDoctor, registerBookablePatient } from './support/appointment-helpers.js';

/** A slot at least `days` days out, at the aligned half-hour boundary `giveFullWeekAvailability` offers. */
function slotDaysOut(days: number): Date {
  const target = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const stepMs = 30 * 60_000;
  return new Date(Math.ceil(target.getTime() / stepMs) * stepMs);
}

describe('Doctor reschedules and rebooks appointments', () => {
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

  it('Doctor reschedules their own appointment', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const booked = await patient.agent
      .post('/api/appointments')
      .send({ doctorId: doctor.id, startsAt: slotDaysOut(2).toISOString(), reason: 'Booked by the patient first' })
      .expect(201);

    const newStart = slotDaysOut(3);
    const res = await doctor.agent
      .post(`/api/appointments/${booked.body.id}/reschedule`)
      .send({ startsAt: newStart.toISOString() });

    expect(res.status).toBe(201);
    expect(res.body.startsAt).toBe(newStart.toISOString());
    expect(res.body.rescheduledFromId).toBe(booked.body.id);

    const original = await patient.agent.get(`/api/appointments/${booked.body.id}`).expect(200);
    expect(original.body.status).toBe('CANCELLED');
    expect(original.body.cancellationReason).toBe('Rescheduled');
  });

  it("Doctor cannot reschedule another doctor's appointment", async () => {
    const doctor = await registerBookableDoctor(app);
    const otherDoctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const booked = await patient.agent
      .post('/api/appointments')
      .send({ doctorId: doctor.id, startsAt: slotDaysOut(2).toISOString(), reason: 'Booked with the first doctor' })
      .expect(201);

    const res = await otherDoctor.agent
      .post(`/api/appointments/${booked.body.id}/reschedule`)
      .send({ startsAt: slotDaysOut(3).toISOString() });

    expect(res.status).toBe(404);
  });

  it('Doctor books a follow-up with the same patient', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const booked = await patient.agent
      .post('/api/appointments')
      .send({ doctorId: doctor.id, startsAt: slotDaysOut(2).toISOString(), reason: 'Initial consultation reason' })
      .expect(201);

    const followUpStart = slotDaysOut(4);
    const res = await doctor.agent
      .post(`/api/appointments/${booked.body.id}/rebook`)
      .send({ startsAt: followUpStart.toISOString() });

    expect(res.status).toBe(201);
    expect(res.body.id).not.toBe(booked.body.id);
    expect(res.body.startsAt).toBe(followUpStart.toISOString());
    expect(res.body.status).toBe('BOOKED');
    expect(res.body.patient.id).toBe(booked.body.patient.id);
    expect(res.body.reason).toBe('Follow-up: Initial consultation reason');

    // The original appointment is untouched.
    const original = await patient.agent.get(`/api/appointments/${booked.body.id}`).expect(200);
    expect(original.body.status).toBe('BOOKED');
  });

  it("Doctor cannot rebook from another doctor's appointment", async () => {
    const doctor = await registerBookableDoctor(app);
    const otherDoctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const booked = await patient.agent
      .post('/api/appointments')
      .send({ doctorId: doctor.id, startsAt: slotDaysOut(2).toISOString(), reason: 'Booked with the first doctor' })
      .expect(201);

    const res = await otherDoctor.agent
      .post(`/api/appointments/${booked.body.id}/rebook`)
      .send({ startsAt: slotDaysOut(4).toISOString() });

    expect(res.status).toBe(404);
  });

  it('Patients cannot use the rebook endpoint', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const booked = await patient.agent
      .post('/api/appointments')
      .send({ doctorId: doctor.id, startsAt: slotDaysOut(2).toISOString(), reason: 'Booked by the patient first' })
      .expect(201);

    const res = await patient.agent
      .post(`/api/appointments/${booked.body.id}/rebook`)
      .send({ startsAt: slotDaysOut(4).toISOString() });

    expect(res.status).toBe(403);
  });
});
