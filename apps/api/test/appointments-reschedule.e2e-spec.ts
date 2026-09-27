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

describe('Reschedule an appointment', () => {
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

  it('Successful reschedule', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const originalStart = slotDaysOut(2);

    const booked = await patient.agent
      .post('/api/appointments')
      .send({ doctorId: doctor.id, startsAt: originalStart.toISOString(), reason: 'Original booking to reschedule' })
      .expect(201);

    const newStart = slotDaysOut(3);
    const res = await patient.agent
      .post(`/api/appointments/${booked.body.id}/reschedule`)
      .send({ startsAt: newStart.toISOString() });

    expect(res.status).toBe(201);
    expect(res.body.startsAt).toBe(newStart.toISOString());
    expect(res.body.rescheduledFromId).toBe(booked.body.id);

    const original = await patient.agent.get(`/api/appointments/${booked.body.id}`).expect(200);
    expect(original.body.status).toBe('CANCELLED');
    expect(original.body.cancellationReason).toBe('Rescheduled');
    expect(original.body.rescheduledToId).toBe(res.body.id);

    // The original slot is available again.
    const slots = await patient.agent.get(`/api/doctors/${doctor.id}/slots`).query({
      from: new Date().toISOString(),
      to: new Date(originalStart.getTime() + 60 * 60 * 1000).toISOString(),
    });
    expect(slots.body.map((s: { start: string }) => s.start)).toContain(originalStart.toISOString());
  });

  it('Too close to start', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);

    // Bypass the 60-day booking horizon concern: 90 minutes is well within it.
    const stepMs = 30 * 60_000;
    const soonStart = new Date(Math.ceil((Date.now() + 90 * 60_000) / stepMs) * stepMs);
    const booked = await patient.agent
      .post('/api/appointments')
      .send({ doctorId: doctor.id, startsAt: soonStart.toISOString(), reason: 'Starts soon, cannot reschedule' })
      .expect(201);

    const newStart = slotDaysOut(3);
    const res = await patient.agent
      .post(`/api/appointments/${booked.body.id}/reschedule`)
      .send({ startsAt: newStart.toISOString() });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('RESCHEDULE_WINDOW_CLOSED');

    const unchanged = await patient.agent.get(`/api/appointments/${booked.body.id}`).expect(200);
    expect(unchanged.body.status).toBe('BOOKED');
  });

  it('New slot unavailable', async () => {
    const doctor = await registerBookableDoctor(app);
    const patientA = await registerBookablePatient(app);
    const patientB = await registerBookablePatient(app);

    const startA = slotDaysOut(2);
    const bookedA = await patientA.agent
      .post('/api/appointments')
      .send({ doctorId: doctor.id, startsAt: startA.toISOString(), reason: 'Patient A booking' })
      .expect(201);

    const startB = slotDaysOut(3);
    await patientB.agent
      .post('/api/appointments')
      .send({ doctorId: doctor.id, startsAt: startB.toISOString(), reason: 'Patient B booking' })
      .expect(201);

    // Patient A tries to reschedule into patient B's slot.
    const res = await patientA.agent
      .post(`/api/appointments/${bookedA.body.id}/reschedule`)
      .send({ startsAt: startB.toISOString() });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('SLOT_UNAVAILABLE');

    const unchanged = await patientA.agent.get(`/api/appointments/${bookedA.body.id}`).expect(200);
    expect(unchanged.body.status).toBe('BOOKED');
  });

  it('Doctor stopped accepting bookings', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const originalStart = slotDaysOut(2);

    const booked = await patient.agent
      .post('/api/appointments')
      .send({ doctorId: doctor.id, startsAt: originalStart.toISOString(), reason: 'Original booking to reschedule' })
      .expect(201);

    await doctor.agent.patch('/api/doctors/me/profile').send({ acceptingBookings: false }).expect(200);

    const res = await patient.agent
      .post(`/api/appointments/${booked.body.id}/reschedule`)
      .send({ startsAt: slotDaysOut(3).toISOString() });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('DOCTOR_NOT_ACCEPTING_BOOKINGS');

    const unchanged = await patient.agent.get(`/api/appointments/${booked.body.id}`).expect(200);
    expect(unchanged.body.status).toBe('BOOKED');
  });

  it("Not the patient's appointment", async () => {
    const doctor = await registerBookableDoctor(app);
    const owner = await registerBookablePatient(app);
    const other = await registerBookablePatient(app);

    const booked = await owner.agent
      .post('/api/appointments')
      .send({ doctorId: doctor.id, startsAt: slotDaysOut(2).toISOString(), reason: "Owner's own booking" })
      .expect(201);

    const res = await other.agent
      .post(`/api/appointments/${booked.body.id}/reschedule`)
      .send({ startsAt: slotDaysOut(3).toISOString() });

    expect(res.status).toBe(404);
  });
});
