import { afterEach, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { createTestApp } from './support/test-app.js';
import { resetDatabase } from './support/reset-db.js';
import { registerBookableDoctor, registerBookablePatient } from './support/appointment-helpers.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

function slotDaysOut(days: number): Date {
  const target = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const stepMs = 30 * 60_000;
  return new Date(Math.ceil(target.getTime() / stepMs) * stepMs);
}

describe('Cancel an appointment', () => {
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

  it('Patient cancels', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const booked = await patient.agent
      .post('/api/appointments')
      .send({ doctorId: doctor.id, startsAt: slotDaysOut(1).toISOString(), reason: 'To be cancelled by the patient' })
      .expect(201);

    const res = await patient.agent.post(`/api/appointments/${booked.body.id}/cancel`).send({});

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CANCELLED');
    expect(res.body.cancelledByRole).toBe('PATIENT');

    const slots = await patient.agent.get(`/api/doctors/${doctor.id}/slots`).query({
      from: new Date().toISOString(),
      to: new Date(slotDaysOut(1).getTime() + 60 * 60 * 1000).toISOString(),
    });
    expect(slots.body.map((s: { start: string }) => s.start)).toContain(slotDaysOut(1).toISOString());
  });

  it('Doctor cancels with reason', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const booked = await patient.agent
      .post('/api/appointments')
      .send({ doctorId: doctor.id, startsAt: slotDaysOut(1).toISOString(), reason: 'To be cancelled by the doctor' })
      .expect(201);

    const res = await doctor.agent
      .post(`/api/appointments/${booked.body.id}/cancel`)
      .send({ reason: 'Unexpected emergency' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CANCELLED');
    expect(res.body.cancelledByRole).toBe('DOCTOR');
    expect(res.body.cancellationReason).toBe('Unexpected emergency');
  });

  it('Doctor cancels without reason', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const booked = await patient.agent
      .post('/api/appointments')
      .send({ doctorId: doctor.id, startsAt: slotDaysOut(1).toISOString(), reason: 'Doctor tries to cancel blank' })
      .expect(201);

    const res = await doctor.agent.post(`/api/appointments/${booked.body.id}/cancel`).send({});

    expect(res.status).toBe(400);
  });

  it('Already started or not booked', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const booked = await patient.agent
      .post('/api/appointments')
      .send({ doctorId: doctor.id, startsAt: slotDaysOut(1).toISOString(), reason: 'Will be cancelled twice' })
      .expect(201);

    await patient.agent.post(`/api/appointments/${booked.body.id}/cancel`).send({}).expect(200);

    // Already cancelled: not BOOKED anymore.
    const res = await patient.agent.post(`/api/appointments/${booked.body.id}/cancel`).send({});
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('APPOINTMENT_NOT_CANCELLABLE');

    // Already started: directly move a fresh booking's start into the past.
    const startsSoon = await patient.agent
      .post('/api/appointments')
      .send({ doctorId: doctor.id, startsAt: slotDaysOut(2).toISOString(), reason: 'Will be back-dated to simulate start' })
      .expect(201);
    const prisma = app.get(PrismaService);
    await prisma.appointment.update({
      where: { id: startsSoon.body.id },
      data: { startsAt: new Date(Date.now() - 60_000), endsAt: new Date(Date.now() + 60_000) },
    });
    const startedRes = await doctor.agent
      .post(`/api/appointments/${startsSoon.body.id}/cancel`)
      .send({ reason: 'Trying to cancel a started appointment' });
    expect(startedRes.status).toBe(409);
    expect(startedRes.body.code).toBe('APPOINTMENT_NOT_CANCELLABLE');
  });

  it('Not a participant', async () => {
    const doctor = await registerBookableDoctor(app);
    const otherDoctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const otherPatient = await registerBookablePatient(app);

    const booked = await patient.agent
      .post('/api/appointments')
      .send({ doctorId: doctor.id, startsAt: slotDaysOut(1).toISOString(), reason: 'Only the owner may cancel' })
      .expect(201);

    const otherPatientRes = await otherPatient.agent.post(`/api/appointments/${booked.body.id}/cancel`).send({});
    expect(otherPatientRes.status).toBe(404);

    const otherDoctorRes = await otherDoctor.agent
      .post(`/api/appointments/${booked.body.id}/cancel`)
      .send({ reason: 'Not my appointment' });
    expect(otherDoctorRes.status).toBe(404);
  });
});
