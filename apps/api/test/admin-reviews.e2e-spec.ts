import { afterEach, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
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
import { AuditAction } from '../src/generated/prisma/enums.js';

async function createReview(
  app: INestApplication,
  doctor: Awaited<ReturnType<typeof registerBookableDoctor>>,
  rating = 4,
  comment?: string,
): Promise<{ reviewId: string; patient: Awaited<ReturnType<typeof registerBookablePatient>> }> {
  const patient = await registerBookablePatient(app);
  const appointment = await createAppointmentDirect(app, {
    patientId: patient.id,
    doctorId: doctor.id,
    startsAt: new Date(Date.now() + 60_000),
  });
  await completeAppointmentDirect(app, appointment.id);
  await patient.agent.put(`/api/appointments/${appointment.id}/review`).send({ rating, comment }).expect(200);

  const prisma = app.get(PrismaService);
  const review = await prisma.doctorReview.findUniqueOrThrow({ where: { appointmentId: appointment.id } });
  return { reviewId: review.id, patient };
}

describe('Review moderation', () => {
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

  it('Hide a review', async () => {
    const admin = await createAndSignInAdmin(app);
    const doctor = await registerBookableDoctor(app);
    const { reviewId } = await createReview(app, doctor);

    const res = await admin.agent
      .post(`/api/admin/reviews/${reviewId}/hide`)
      .send({ reason: "Contains another patient's name" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: reviewId, hidden: true, hiddenReason: "Contains another patient's name" });

    const publicRes = await admin.agent.get(`/api/doctors/${doctor.id}/reviews`);
    expect(publicRes.body.items).toHaveLength(0);
    expect(publicRes.body.reviewCount).toBe(0);
  });

  it('Unhide a review', async () => {
    const admin = await createAndSignInAdmin(app);
    const doctor = await registerBookableDoctor(app);
    const { reviewId } = await createReview(app, doctor);
    await admin.agent.post(`/api/admin/reviews/${reviewId}/hide`).send({ reason: 'Under review by staff' }).expect(200);

    const res = await admin.agent.post(`/api/admin/reviews/${reviewId}/unhide`).send({ reason: 'Reviewed, no policy violation' });
    expect(res.status).toBe(200);
    expect(res.body.hidden).toBe(false);

    const publicRes = await admin.agent.get(`/api/doctors/${doctor.id}/reviews`);
    expect(publicRes.body.items).toHaveLength(1);
    expect(publicRes.body.reviewCount).toBe(1);
  });

  it('Missing reason', async () => {
    const admin = await createAndSignInAdmin(app);
    const doctor = await registerBookableDoctor(app);
    const { reviewId } = await createReview(app, doctor);

    const hideRes = await admin.agent.post(`/api/admin/reviews/${reviewId}/hide`).send({});
    expect(hideRes.status).toBe(400);

    const prisma = app.get(PrismaService);
    const stillVisible = await prisma.doctorReview.findUniqueOrThrow({ where: { id: reviewId } });
    expect(stillVisible.hiddenAt).toBeNull();

    await admin.agent.post(`/api/admin/reviews/${reviewId}/hide`).send({ reason: 'A valid five-plus char reason' }).expect(200);
    const unhideRes = await admin.agent.post(`/api/admin/reviews/${reviewId}/unhide`).send({});
    expect(unhideRes.status).toBe(400);
  });

  it('Redundant hide', async () => {
    const admin = await createAndSignInAdmin(app);
    const doctor = await registerBookableDoctor(app);
    const { reviewId } = await createReview(app, doctor);
    await admin.agent.post(`/api/admin/reviews/${reviewId}/hide`).send({ reason: 'First hide' }).expect(200);

    const res = await admin.agent.post(`/api/admin/reviews/${reviewId}/hide`).send({ reason: 'Second hide attempt' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('REVIEW_HIDE_STATUS_UNCHANGED');
  });

  it('Lists reviews filtered by doctor and hidden status', async () => {
    const admin = await createAndSignInAdmin(app);
    const doctorA = await registerBookableDoctor(app);
    const doctorB = await registerBookableDoctor(app);
    const { reviewId: visibleForA } = await createReview(app, doctorA, 5);
    const { reviewId: hiddenForA } = await createReview(app, doctorA, 2);
    await createReview(app, doctorB, 4);
    await admin.agent.post(`/api/admin/reviews/${hiddenForA}/hide`).send({ reason: 'Under review' }).expect(200);

    const forDoctorA = await admin.agent.get('/api/admin/reviews').query({ doctorId: doctorA.id });
    expect(forDoctorA.status).toBe(200);
    expect(forDoctorA.body.items.map((r: { id: string }) => r.id).sort()).toEqual([visibleForA, hiddenForA].sort());

    const onlyHidden = await admin.agent.get('/api/admin/reviews').query({ doctorId: doctorA.id, hidden: true });
    expect(onlyHidden.body.items.map((r: { id: string }) => r.id)).toEqual([hiddenForA]);

    const onlyVisible = await admin.agent.get('/api/admin/reviews').query({ doctorId: doctorA.id, hidden: false });
    expect(onlyVisible.body.items.map((r: { id: string }) => r.id)).toEqual([visibleForA]);
  });

  it('Non-admin denied', async () => {
    const doctor = await registerBookableDoctor(app);
    const { reviewId, patient } = await createReview(app, doctor);

    expect((await patient.agent.get('/api/admin/reviews')).status).toBe(403);
    expect((await doctor.agent.post(`/api/admin/reviews/${reviewId}/hide`).send({ reason: 'Not allowed' })).status).toBe(403);
    expect((await patient.agent.post(`/api/admin/reviews/${reviewId}/unhide`).send({ reason: 'Not allowed' })).status).toBe(403);
  });

  it('Review hidden audited', async () => {
    const admin = await createAndSignInAdmin(app);
    const doctor = await registerBookableDoctor(app);
    const secretComment = 'This mentions another patient by name, quite specifically.';
    const { reviewId } = await createReview(app, doctor, 5, secretComment);

    await admin.agent.post(`/api/admin/reviews/${reviewId}/hide`).send({ reason: 'Reported as abusive' }).expect(200);

    const prisma = app.get(PrismaService);
    const entries = await prisma.auditLog.findMany({ where: { action: AuditAction.REVIEW_HIDDEN, entityId: reviewId } });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ actorId: admin.id, reason: 'Reported as abusive' });
    expect(JSON.stringify(entries[0])).not.toContain(secretComment);
  });

  it('Review unhidden audited', async () => {
    const admin = await createAndSignInAdmin(app);
    const doctor = await registerBookableDoctor(app);
    const { reviewId } = await createReview(app, doctor);
    await admin.agent.post(`/api/admin/reviews/${reviewId}/hide`).send({ reason: 'Initial hide' }).expect(200);

    await admin.agent.post(`/api/admin/reviews/${reviewId}/unhide`).send({ reason: 'False positive, restoring' }).expect(200);

    const prisma = app.get(PrismaService);
    const entries = await prisma.auditLog.findMany({ where: { action: AuditAction.REVIEW_UNHIDDEN, entityId: reviewId } });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ actorId: admin.id, reason: 'False positive, restoring' });
  });
});
