import { afterEach, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { createTestApp } from './support/test-app.js';
import { resetDatabase } from './support/reset-db.js';
import {
  nextSlotStart,
  registerBookableDoctor,
  registerBookablePatient,
} from './support/appointment-helpers.js';

async function addDependent(
  patient: Awaited<ReturnType<typeof registerBookablePatient>>,
  overrides: Partial<{ firstName: string; lastName: string; birthDate: string; relationship: string }> = {},
): Promise<string> {
  const res = await patient.agent
    .post('/api/patients/me/dependents')
    .send({
      firstName: overrides.firstName ?? 'Jamie',
      lastName: overrides.lastName ?? 'Lovelace',
      birthDate: overrides.birthDate ?? '2018-06-15',
      relationship: overrides.relationship ?? 'CHILD',
    })
    .expect(201);
  return res.body.id as string;
}

describe('Booking for a dependent', () => {
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

  it('Booking for a dependent', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const dependentId = await addDependent(patient);
    const start = nextSlotStart(new Date());

    const res = await patient.agent
      .post('/api/appointments')
      .send({ doctorId: doctor.id, startsAt: start.toISOString(), reason: 'Fever and sore throat', dependentId })
      .expect(201);

    expect(res.body.dependent).toMatchObject({ id: dependentId, displayName: 'Jamie Lovelace', relationship: 'CHILD' });
    expect(res.body.patient.id).toBe(patient.id);
  });

  it('Dependent not owned by the patient', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const otherPatient = await registerBookablePatient(app);
    const otherDependentId = await addDependent(otherPatient);
    const start = nextSlotStart(new Date());

    const res = await patient.agent
      .post('/api/appointments')
      .send({ doctorId: doctor.id, startsAt: start.toISOString(), reason: 'Fever and sore throat', dependentId: otherDependentId });
    expect(res.status).toBe(404);
  });

  it('Reschedule preserves the dependent', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const dependentId = await addDependent(patient);
    // Well beyond the 2-hour reschedule cutoff (unlike `nextSlotStart`'s default ~61-minute lead).
    const start = nextSlotStart(new Date(), 30, 3 * 24 * 60);
    const booked = await patient.agent
      .post('/api/appointments')
      .send({ doctorId: doctor.id, startsAt: start.toISOString(), reason: 'Fever and sore throat', dependentId })
      .expect(201);

    const newStart = nextSlotStart(new Date(), 30, 6 * 24 * 60);
    const rescheduled = await patient.agent
      .post(`/api/appointments/${booked.body.id as string}/reschedule`)
      .send({ startsAt: newStart.toISOString() })
      .expect(201);

    expect(rescheduled.body.dependent).toMatchObject({ id: dependentId });
  });

  it('Appointment for a dependent shows in listings', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const dependentId = await addDependent(patient);
    const start = nextSlotStart(new Date());
    await patient.agent
      .post('/api/appointments')
      .send({ doctorId: doctor.id, startsAt: start.toISOString(), reason: 'Fever and sore throat', dependentId })
      .expect(201);

    const doctorList = await doctor.agent.get('/api/appointments').query({ scope: 'upcoming' }).expect(200);
    const entry = doctorList.body.items.find((item: { dependent: unknown }) => item.dependent !== null);
    expect(entry.dependent).toMatchObject({ id: dependentId, displayName: 'Jamie Lovelace', relationship: 'CHILD' });
  });

  it('Too many upcoming appointments across self and dependents', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const dependentId = await addDependent(patient);
    const base = nextSlotStart(new Date());

    // 5 upcoming appointments split across the account and the dependent.
    for (let i = 0; i < 5; i += 1) {
      const start = new Date(base.getTime() + i * 24 * 3_600_000);
      await patient.agent
        .post('/api/appointments')
        .send({
          doctorId: doctor.id,
          startsAt: start.toISOString(),
          reason: 'Recurring check-in appointment',
          ...(i % 2 === 0 ? { dependentId } : {}),
        })
        .expect(201);
    }

    const sixthForSelf = await patient.agent.post('/api/appointments').send({
      doctorId: doctor.id,
      startsAt: new Date(base.getTime() + 5 * 24 * 3_600_000).toISOString(),
      reason: 'One appointment too many',
    });
    expect(sixthForSelf.status).toBe(409);
    expect(sixthForSelf.body.code).toBe('BOOKING_LIMIT_REACHED');

    const sixthForDependent = await patient.agent.post('/api/appointments').send({
      doctorId: doctor.id,
      startsAt: new Date(base.getTime() + 6 * 24 * 3_600_000).toISOString(),
      reason: 'One appointment too many',
      dependentId,
    });
    expect(sixthForDependent.status).toBe(409);
    expect(sixthForDependent.body.code).toBe('BOOKING_LIMIT_REACHED');
  });

  it('Patient already busy across self and a dependent', async () => {
    const doctor = await registerBookableDoctor(app);
    const otherDoctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const dependentId = await addDependent(patient);
    const start = nextSlotStart(new Date());

    await patient.agent
      .post('/api/appointments')
      .send({ doctorId: doctor.id, startsAt: start.toISOString(), reason: 'Booked for the dependent', dependentId })
      .expect(201);

    const conflicting = await patient.agent.post('/api/appointments').send({
      doctorId: otherDoctor.id,
      startsAt: start.toISOString(),
      reason: 'Overlaps the dependent visit',
    });
    expect(conflicting.status).toBe(409);
    expect(conflicting.body.code).toBe('PATIENT_CONFLICT');
  });

  it('Booking for a dependent notifies the doctor by the dependent\'s name', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const dependentId = await addDependent(patient);
    const start = nextSlotStart(new Date());

    await patient.agent
      .post('/api/appointments')
      .send({ doctorId: doctor.id, startsAt: start.toISOString(), reason: 'Fever and sore throat', dependentId })
      .expect(201);

    const notifications = await doctor.agent.get('/api/notifications').expect(200);
    const booking = notifications.body.items.find((item: { type: string }) => item.type === 'APPOINTMENT_BOOKED');
    expect(booking.body).toContain('Jamie Lovelace');
    expect(booking.body).not.toContain(patient.email);
  });
});
