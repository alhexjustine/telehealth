import { afterEach, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { createTestApp } from './support/test-app.js';
import { resetDatabase } from './support/reset-db.js';
import { createAndSignInAdmin, registerDoctor, registerPatient } from './support/auth-helpers.js';
import {
  approveDoctor,
  giveFullWeekAvailability,
  nextSlotStart,
  registerBookableDoctor,
  registerBookablePatient,
} from './support/appointment-helpers.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Book an appointment', () => {
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

  it('Successful booking', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const start = nextSlotStart(new Date());

    const symptoms = await patient.agent.get('/api/symptoms').expect(200);
    const symptomIds = [symptoms.body[0].symptoms[0].id, symptoms.body[0].symptoms[1].id];

    const res = await patient.agent.post('/api/appointments').send({
      doctorId: doctor.id,
      startsAt: start.toISOString(),
      reason: 'Recurring headaches for the past week',
      symptomIds,
    });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('BOOKED');
    expect(res.body.doctor.id).toBe(doctor.id);
    expect(res.body.reason).toBe('Recurring headaches for the past week');
    expect(res.body.symptoms).toHaveLength(2);

    // That slot is no longer offered.
    const to = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    const slots = await patient.agent
      .get(`/api/doctors/${doctor.id}/slots`)
      .query({ from: new Date().toISOString(), to: to.toISOString() });
    expect(slots.body.map((s: { start: string }) => s.start)).not.toContain(start.toISOString());
  });

  it('Incomplete profile', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerPatient(app); // profile deliberately incomplete
    const start = nextSlotStart(new Date());

    const res = await patient.agent.post('/api/appointments').send({
      doctorId: doctor.id,
      startsAt: start.toISOString(),
      reason: 'A valid ten-plus character reason',
    });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('PROFILE_INCOMPLETE');
  });

  it('Not an available slot', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);

    // Less than 60 minutes away.
    const soon = await patient.agent.post('/api/appointments').send({
      doctorId: doctor.id,
      startsAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      reason: 'A valid ten-plus character reason',
    });
    expect(soon.status).toBe(409);
    expect(soon.body.code).toBe('SLOT_UNAVAILABLE');

    // Not aligned to a slot boundary.
    const misaligned = await patient.agent.post('/api/appointments').send({
      doctorId: doctor.id,
      startsAt: new Date(nextSlotStart(new Date()).getTime() + 5 * 60 * 1000).toISOString(),
      reason: 'A valid ten-plus character reason',
    });
    expect(misaligned.status).toBe(409);
    expect(misaligned.body.code).toBe('SLOT_UNAVAILABLE');

    // Already booked by someone else.
    const start = nextSlotStart(new Date());
    const otherPatient = await registerBookablePatient(app);
    await otherPatient.agent
      .post('/api/appointments')
      .send({ doctorId: doctor.id, startsAt: start.toISOString(), reason: 'First booking of that slot' })
      .expect(201);
    const alreadyBooked = await patient.agent.post('/api/appointments').send({
      doctorId: doctor.id,
      startsAt: start.toISOString(),
      reason: 'A valid ten-plus character reason',
    });
    expect(alreadyBooked.status).toBe(409);
    expect(alreadyBooked.body.code).toBe('SLOT_UNAVAILABLE');
  });

  it('Too far ahead', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const start = nextSlotStart(new Date(Date.now() + 61 * 24 * 60 * 60 * 1000));

    const res = await patient.agent.post('/api/appointments').send({
      doctorId: doctor.id,
      startsAt: start.toISOString(),
      reason: 'A valid ten-plus character reason',
    });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('BEYOND_BOOKING_HORIZON');
  });

  it('Too many upcoming appointments', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);

    for (let i = 0; i < 5; i++) {
      const start = nextSlotStart(new Date(Date.now() + i * 24 * 60 * 60 * 1000));
      await patient.agent
        .post('/api/appointments')
        .send({ doctorId: doctor.id, startsAt: start.toISOString(), reason: `Booking number ${i}` })
        .expect(201);
    }

    const sixthStart = nextSlotStart(new Date(Date.now() + 5 * 24 * 60 * 60 * 1000));
    const res = await patient.agent.post('/api/appointments').send({
      doctorId: doctor.id,
      startsAt: sixthStart.toISOString(),
      reason: 'A valid ten-plus character reason',
    });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('BOOKING_LIMIT_REACHED');
  });

  it('Patient already busy', async () => {
    const doctorA = await registerBookableDoctor(app);
    const doctorB = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const start = nextSlotStart(new Date());

    await patient.agent
      .post('/api/appointments')
      .send({ doctorId: doctorA.id, startsAt: start.toISOString(), reason: 'First doctor booking' })
      .expect(201);

    const res = await patient.agent.post('/api/appointments').send({
      doctorId: doctorB.id,
      startsAt: start.toISOString(),
      reason: 'A valid ten-plus character reason',
    });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('PATIENT_CONFLICT');
  });

  it('Hidden doctor', async () => {
    const patient = await registerBookablePatient(app);
    const start = nextSlotStart(new Date());

    const pending = await registerDoctor(app);
    await giveFullWeekAvailability(pending.agent);
    const pendingRes = await patient.agent.post('/api/appointments').send({
      doctorId: pending.id,
      startsAt: start.toISOString(),
      reason: 'A valid ten-plus character reason',
    });
    expect(pendingRes.status).toBe(404);

    const rejected = await registerDoctor(app);
    await approveDoctor(app, rejected.id);
    await giveFullWeekAvailability(rejected.agent);
    await app.get(PrismaService).doctorProfile.update({
      where: { userId: rejected.id },
      data: { verificationStatus: 'REJECTED' },
    });
    const rejectedRes = await patient.agent.post('/api/appointments').send({
      doctorId: rejected.id,
      startsAt: start.toISOString(),
      reason: 'A valid ten-plus character reason',
    });
    expect(rejectedRes.status).toBe(404);

    const suspended = await registerBookableDoctor(app);
    await app.get(PrismaService).user.update({ where: { id: suspended.id }, data: { status: 'SUSPENDED' } });
    const suspendedRes = await patient.agent.post('/api/appointments').send({
      doctorId: suspended.id,
      startsAt: start.toISOString(),
      reason: 'A valid ten-plus character reason',
    });
    expect(suspendedRes.status).toBe(404);
  });

  it('Doctor not accepting bookings', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const start = nextSlotStart(new Date());

    await doctor.agent.patch('/api/doctors/me/profile').send({ acceptingBookings: false }).expect(200);

    const res = await patient.agent.post('/api/appointments').send({
      doctorId: doctor.id,
      startsAt: start.toISOString(),
      reason: 'A valid ten-plus character reason',
    });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('DOCTOR_NOT_ACCEPTING_BOOKINGS');
  });

  it('Non-patient denied (booking)', async () => {
    const doctor = await registerBookableDoctor(app);
    const otherDoctor = await registerDoctor(app);
    const admin = await createAndSignInAdmin(app);
    const start = nextSlotStart(new Date());

    const doctorRes = await otherDoctor.agent.post('/api/appointments').send({
      doctorId: doctor.id,
      startsAt: start.toISOString(),
      reason: 'A valid ten-plus character reason',
    });
    expect(doctorRes.status).toBe(403);

    const adminRes = await admin.agent.post('/api/appointments').send({
      doctorId: doctor.id,
      startsAt: start.toISOString(),
      reason: 'A valid ten-plus character reason',
    });
    expect(adminRes.status).toBe(403);
  });

  it('Concurrent bookings of the same slot', async () => {
    const doctor = await registerBookableDoctor(app);
    const patientA = await registerBookablePatient(app);
    const patientB = await registerBookablePatient(app);
    const start = nextSlotStart(new Date());

    const [resA, resB] = await Promise.all([
      patientA.agent.post('/api/appointments').send({
        doctorId: doctor.id,
        startsAt: start.toISOString(),
        reason: 'Concurrent booking attempt A',
      }),
      patientB.agent.post('/api/appointments').send({
        doctorId: doctor.id,
        startsAt: start.toISOString(),
        reason: 'Concurrent booking attempt B',
      }),
    ]);

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([201, 409]);
    const failed = resA.status === 409 ? resA : resB;
    expect(failed.body.code).toBe('SLOT_UNAVAILABLE');

    const count = await app.get(PrismaService).appointment.count({
      where: { doctorId: doctor.id, status: 'BOOKED', startsAt: start },
    });
    expect(count).toBe(1);
  });
});
