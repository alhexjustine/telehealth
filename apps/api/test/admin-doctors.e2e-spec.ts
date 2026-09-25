import { afterEach, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './support/test-app.js';
import { resetDatabase } from './support/reset-db.js';
import { createAndSignInAdmin, registerDoctor, registerPatient } from './support/auth-helpers.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { AuditAction } from '../src/generated/prisma/enums.js';

describe('Admin doctor review', () => {
  let app: INestApplication;
  let specializationIds: string[];

  beforeAll(async () => {
    await resetDatabase();
    const bootstrapApp = await createTestApp();
    const list = await request(bootstrapApp.getHttpServer()).get('/api/specializations').expect(200);
    specializationIds = list.body.map((s: { id: string }) => s.id);
    await bootstrapApp.close();
  });

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  function spec(index: number): string {
    const id = specializationIds[index];
    if (!id) throw new Error(`No specialization at index ${index}`);
    return id;
  }

  it('Pending queue', async () => {
    const admin = await createAndSignInAdmin(app);
    const pending = await registerDoctor(app, { specializationIds: [spec(0)] });
    const approved = await registerDoctor(app, { specializationIds: [spec(0)] });
    await admin.agent.post(`/api/admin/doctors/${approved.id}/approve`).send({}).expect(200);

    const res = await admin.agent.get('/api/admin/doctors').expect(200);

    expect(res.body.items.map((d: { id: string }) => d.id)).toEqual([pending.id]);
  });

  it('Full profile for review', async () => {
    const admin = await createAndSignInAdmin(app);
    const doctor = await registerDoctor(app, { specializationIds: [spec(0)] });

    const res = await admin.agent.get(`/api/admin/doctors/${doctor.id}`).expect(200);

    expect(res.body).toMatchObject({ email: doctor.email, licenseNumber: expect.any(String) });
  });

  it('Non-admin denied (review)', async () => {
    const doctor = await registerDoctor(app, { specializationIds: [spec(0)] });
    const patient = await registerPatient(app);

    expect((await doctor.agent.get('/api/admin/doctors')).status).toBe(403);
    expect((await patient.agent.get(`/api/admin/doctors/${doctor.id}`)).status).toBe(403);
    expect((await doctor.agent.post(`/api/admin/doctors/${doctor.id}/approve`).send({})).status).toBe(403);
  });

  it('Approve a pending doctor', async () => {
    const admin = await createAndSignInAdmin(app);
    const doctor = await registerDoctor(app, { specializationIds: [spec(0)] });

    const res = await admin.agent.post(`/api/admin/doctors/${doctor.id}/approve`).send({}).expect(200);
    expect(res.body.verificationStatus).toBe('APPROVED');

    const search = await doctor.agent.get('/api/doctors').expect(200);
    expect(search.body.items.map((d: { id: string }) => d.id)).toContain(doctor.id);
  });

  it('Reject with a note', async () => {
    const admin = await createAndSignInAdmin(app);
    const doctor = await registerDoctor(app, { specializationIds: [spec(0)] });
    const note = 'License number could not be matched to the fictional registry';

    const res = await admin.agent.post(`/api/admin/doctors/${doctor.id}/reject`).send({ note }).expect(200);
    expect(res.body).toMatchObject({ verificationStatus: 'REJECTED', reviewNote: note });

    const home = await doctor.agent.get('/api/doctors/me/profile').expect(200);
    expect(home.body.reviewNote).toBe(note);
  });

  it('Reject without a note', async () => {
    const admin = await createAndSignInAdmin(app);
    const doctor = await registerDoctor(app, { specializationIds: [spec(0)] });

    const res = await admin.agent.post(`/api/admin/doctors/${doctor.id}/reject`).send({});
    expect(res.status).toBe(400);
  });

  it('Same decision twice', async () => {
    const admin = await createAndSignInAdmin(app);
    const doctor = await registerDoctor(app, { specializationIds: [spec(0)] });
    await admin.agent.post(`/api/admin/doctors/${doctor.id}/approve`).send({}).expect(200);

    const res = await admin.agent.post(`/api/admin/doctors/${doctor.id}/approve`).send({});
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('STATUS_UNCHANGED');
  });

  it('Doctor notified of approval', async () => {
    const admin = await createAndSignInAdmin(app);
    const doctor = await registerDoctor(app, { specializationIds: [spec(0)] });
    await admin.agent.post(`/api/admin/doctors/${doctor.id}/approve`).send({}).expect(200);

    const notifications = await doctor.agent.get('/api/notifications').expect(200);
    const unread = notifications.body.items.filter((n: { title: string; readAt: string | null }) => n.title === 'Profile approved' && !n.readAt);
    expect(unread).toHaveLength(1);
  });

  it('Doctor notified of rejection', async () => {
    const admin = await createAndSignInAdmin(app);
    const doctor = await registerDoctor(app, { specializationIds: [spec(0)] });
    const note = 'Please resubmit with a clearer license scan';
    await admin.agent.post(`/api/admin/doctors/${doctor.id}/reject`).send({ note }).expect(200);

    const notifications = await doctor.agent.get('/api/notifications').expect(200);
    const unread = notifications.body.items.filter(
      (n: { title: string; readAt: string | null; body: string }) => n.title === 'Profile not approved' && !n.readAt,
    );
    expect(unread).toHaveLength(1);
    expect(unread[0].body).toContain(note);
  });

  it('Failed action not audited', async () => {
    const admin = await createAndSignInAdmin(app);
    const doctor = await registerDoctor(app, { specializationIds: [spec(0)] });
    await admin.agent.post(`/api/admin/doctors/${doctor.id}/approve`).send({}).expect(200);

    // Approving an already-approved doctor is rejected (409); no second entry should appear.
    await admin.agent.post(`/api/admin/doctors/${doctor.id}/approve`).send({}).expect(409);

    const prisma = app.get(PrismaService);
    const entries = await prisma.auditLog.findMany({ where: { action: AuditAction.DOCTOR_APPROVED, entityId: doctor.id } });
    expect(entries).toHaveLength(1);
  });

  it('Correct a specialization', async () => {
    const admin = await createAndSignInAdmin(app);
    const doctor = await registerDoctor(app, { specializationIds: [spec(0)] });
    await admin.agent.post(`/api/admin/doctors/${doctor.id}/approve`).send({}).expect(200);

    const res = await admin.agent
      .patch(`/api/admin/doctors/${doctor.id}`)
      .send({ specializationIds: [spec(1)] })
      .expect(200);

    expect(res.body.specializations).toHaveLength(1);
    expect(res.body.specializations[0]).toMatchObject({ id: spec(1) });
    expect(res.body.verificationStatus).toBe('APPROVED');
  });

  it('Invalid admin edit', async () => {
    const admin = await createAndSignInAdmin(app);
    const doctor = await registerDoctor(app, { specializationIds: [spec(0)] });

    const res = await admin.agent.patch(`/api/admin/doctors/${doctor.id}`).send({ consultationMinutes: 25 });
    expect(res.status).toBe(400);

    const profile = await doctor.agent.get('/api/doctors/me/profile').expect(200);
    expect(profile.body.consultationMinutes).toBe(30);
  });
});
