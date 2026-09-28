import { afterEach, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './support/test-app.js';
import { resetDatabase } from './support/reset-db.js';
import { createAndSignInAdmin } from './support/auth-helpers.js';
import {
  completeAppointmentDirect,
  createAppointmentDirect,
  registerBookableDoctor,
  registerBookablePatient,
} from './support/appointment-helpers.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

async function completedAppointment(
  app: INestApplication,
  patient: Awaited<ReturnType<typeof registerBookablePatient>>,
  doctor: Awaited<ReturnType<typeof registerBookableDoctor>>,
): Promise<{ id: string }> {
  const appointment = await createAppointmentDirect(app, {
    patientId: patient.id,
    doctorId: doctor.id,
    startsAt: new Date(Date.now() + 60_000),
  });
  await completeAppointmentDirect(app, appointment.id);
  return appointment;
}

describe('Rate a completed consultation', () => {
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

  it('Leave a review after completion', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const appointment = await completedAppointment(app, patient, doctor);

    const res = await patient.agent
      .put(`/api/appointments/${appointment.id}/review`)
      .send({ rating: 5, comment: 'Very thorough and kind.' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ appointmentId: appointment.id, rating: 5, comment: 'Very thorough and kind.' });

    const prisma = app.get(PrismaService);
    const stored = await prisma.doctorReview.findUnique({ where: { appointmentId: appointment.id } });
    expect(stored).toMatchObject({ doctorId: doctor.id, patientId: patient.id, rating: 5 });
  });

  it('Edit an existing review', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const appointment = await completedAppointment(app, patient, doctor);

    await patient.agent.put(`/api/appointments/${appointment.id}/review`).send({ rating: 3, comment: 'It was okay.' }).expect(200);
    const res = await patient.agent
      .put(`/api/appointments/${appointment.id}/review`)
      .send({ rating: 5, comment: 'Actually, great follow-up.' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ rating: 5, comment: 'Actually, great follow-up.' });

    const prisma = app.get(PrismaService);
    const all = await prisma.doctorReview.findMany({ where: { appointmentId: appointment.id } });
    expect(all).toHaveLength(1);
  });

  it('Not yet completed', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);

    const booked = await createAppointmentDirect(app, {
      patientId: patient.id,
      doctorId: doctor.id,
      startsAt: new Date(Date.now() + 24 * 60 * 60_000),
    });
    const bookedRes = await patient.agent.put(`/api/appointments/${booked.id}/review`).send({ rating: 4 });
    expect(bookedRes.status).toBe(409);
    expect(bookedRes.body.code).toBe('REVIEW_NOT_ELIGIBLE');

    const cancelled = await createAppointmentDirect(app, {
      patientId: patient.id,
      doctorId: doctor.id,
      startsAt: new Date(Date.now() + 25 * 60 * 60_000),
      status: 'CANCELLED',
    });
    const cancelledRes = await patient.agent.put(`/api/appointments/${cancelled.id}/review`).send({ rating: 4 });
    expect(cancelledRes.status).toBe(409);
    expect(cancelledRes.body.code).toBe('REVIEW_NOT_ELIGIBLE');

    const notHeld = await createAppointmentDirect(app, {
      patientId: patient.id,
      doctorId: doctor.id,
      startsAt: new Date(Date.now() + 26 * 60 * 60_000),
      status: 'NOT_HELD',
    });
    const notHeldRes = await patient.agent.put(`/api/appointments/${notHeld.id}/review`).send({ rating: 4 });
    expect(notHeldRes.status).toBe(409);
    expect(notHeldRes.body.code).toBe('REVIEW_NOT_ELIGIBLE');
  });

  it('Rating out of range', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const appointment = await completedAppointment(app, patient, doctor);

    const tooLow = await patient.agent.put(`/api/appointments/${appointment.id}/review`).send({ rating: 0 });
    expect(tooLow.status).toBe(400);
    const tooHigh = await patient.agent.put(`/api/appointments/${appointment.id}/review`).send({ rating: 6 });
    expect(tooHigh.status).toBe(400);

    const prisma = app.get(PrismaService);
    const stored = await prisma.doctorReview.findUnique({ where: { appointmentId: appointment.id } });
    expect(stored).toBeNull();
  });

  it('Comment too long', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const appointment = await completedAppointment(app, patient, doctor);

    const res = await patient.agent
      .put(`/api/appointments/${appointment.id}/review`)
      .send({ rating: 5, comment: 'x'.repeat(1001) });
    expect(res.status).toBe(400);

    const prisma = app.get(PrismaService);
    const stored = await prisma.doctorReview.findUnique({ where: { appointmentId: appointment.id } });
    expect(stored).toBeNull();
  });

  it("Not the account's own appointment", async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const otherPatient = await registerBookablePatient(app);
    const appointment = await completedAppointment(app, patient, doctor);

    const otherPatientRes = await otherPatient.agent.put(`/api/appointments/${appointment.id}/review`).send({ rating: 5 });
    expect(otherPatientRes.status).toBe(404);

    const doctorRes = await doctor.agent.put(`/api/appointments/${appointment.id}/review`).send({ rating: 5 });
    expect(doctorRes.status).toBe(404);
  });

  it('Signed-out denied', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const appointment = await completedAppointment(app, patient, doctor);

    const res = await request(app.getHttpServer()).put(`/api/appointments/${appointment.id}/review`).send({ rating: 5 });
    expect(res.status).toBe(401);
  });

  it("Reads back the caller's own review, or 404 if none", async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const appointment = await completedAppointment(app, patient, doctor);

    const beforeRes = await patient.agent.get(`/api/appointments/${appointment.id}/review`);
    expect(beforeRes.status).toBe(404);

    await patient.agent.put(`/api/appointments/${appointment.id}/review`).send({ rating: 4, comment: 'Good visit.' }).expect(200);
    const afterRes = await patient.agent.get(`/api/appointments/${appointment.id}/review`);
    expect(afterRes.status).toBe(200);
    expect(afterRes.body).toMatchObject({ rating: 4, comment: 'Good visit.' });
  });
});

describe("View a doctor's reviews", () => {
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

  it('List visible reviews', async () => {
    const doctor = await registerBookableDoctor(app);

    // Three distinct patients, one completed appointment each, one review each.
    for (const rating of [5, 4, 3]) {
      const p = await registerBookablePatient(app);
      const appt = await completedAppointment(app, p, doctor);
      await p.agent.put(`/api/appointments/${appt.id}/review`).send({ rating }).expect(200);
    }

    const reviewer = await registerBookablePatient(app);
    const res = await reviewer.agent.get(`/api/doctors/${doctor.id}/reviews`);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(3);
    expect(res.body.items.map((r: { rating: number }) => r.rating)).toEqual([3, 4, 5]);
    for (const item of res.body.items) {
      expect(item).not.toHaveProperty('patientId');
      expect(item).not.toHaveProperty('reviewerId');
    }
  });

  it('Hidden review excluded', async () => {
    const doctor = await registerBookableDoctor(app);
    const admin = await createAndSignInAdmin(app);

    const reviewIds: string[] = [];
    for (const rating of [5, 4, 3, 2]) {
      const p = await registerBookablePatient(app);
      const appt = await completedAppointment(app, p, doctor);
      await p.agent.put(`/api/appointments/${appt.id}/review`).send({ rating }).expect(200);
      const prisma = app.get(PrismaService);
      const row = await prisma.doctorReview.findUniqueOrThrow({ where: { appointmentId: appt.id } });
      reviewIds.push(row.id);
    }

    await admin.agent.post(`/api/admin/reviews/${reviewIds[0]}/hide`).send({ reason: 'Contains identifying details' }).expect(200);

    const patient = await registerBookablePatient(app);
    const res = await patient.agent.get(`/api/doctors/${doctor.id}/reviews`);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(3);
    expect(res.body.reviewCount).toBe(3);
    expect(res.body.averageRating).toBe(3); // (4+3+2)/3
  });

  it('No reviews yet', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);

    const res = await patient.agent.get(`/api/doctors/${doctor.id}/reviews`);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(0);
    expect(res.body.averageRating).toBeNull();
    expect(res.body.reviewCount).toBe(0);
  });

  it('Signed-out denied', async () => {
    const doctor = await registerBookableDoctor(app);
    const res = await request(app.getHttpServer()).get(`/api/doctors/${doctor.id}/reviews`);
    expect(res.status).toBe(401);
  });
});
