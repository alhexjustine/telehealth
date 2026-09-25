import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { createTestApp } from './support/test-app.js';
import { resetDatabase } from './support/reset-db.js';
import { createAndSignInAdmin, registerDoctor, registerPatient } from './support/auth-helpers.js';

describe('Admin audit log viewer', () => {
  let app: INestApplication;

  beforeEach(async () => {
    await resetDatabase();
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('Filter by affected record', async () => {
    const admin = await createAndSignInAdmin(app);
    const doctorA = await registerDoctor(app);
    const doctorB = await registerDoctor(app);

    await admin.agent.post(`/api/admin/doctors/${doctorA.id}/approve`).send({}).expect(200);
    await admin.agent.post(`/api/admin/doctors/${doctorB.id}/approve`).send({}).expect(200);

    const res = await admin.agent.get('/api/admin/audit').query({ entityType: 'DoctorProfile', entityId: doctorA.id }).expect(200);

    expect(res.body.items.length).toBeGreaterThanOrEqual(1);
    for (const entry of res.body.items) {
      expect(entry.entityType).toBe('DoctorProfile');
      expect(entry.entityId).toBe(doctorA.id);
    }
    // Newest first.
    const timestamps = res.body.items.map((e: { createdAt: string }) => new Date(e.createdAt).getTime());
    expect(timestamps).toEqual([...timestamps].sort((a, b) => b - a));
  });

  it('Entry detail includes before/after values', async () => {
    const admin = await createAndSignInAdmin(app);
    const doctor = await registerDoctor(app);
    await admin.agent.post(`/api/admin/doctors/${doctor.id}/approve`).send({}).expect(200);

    const list = await admin.agent.get('/api/admin/audit').query({ entityId: doctor.id }).expect(200);
    const entryId = list.body.items[0].id as string;

    const res = await admin.agent.get(`/api/admin/audit/${entryId}`).expect(200);
    expect(res.body.before).toMatchObject({ verificationStatus: 'PENDING' });
    expect(res.body.after).toMatchObject({ verificationStatus: 'APPROVED' });
  });

  it('Non-admin denied (audit)', async () => {
    const patient = await registerPatient(app);
    const doctor = await registerDoctor(app);

    expect((await patient.agent.get('/api/admin/audit')).status).toBe(403);
    expect((await doctor.agent.get('/api/admin/audit')).status).toBe(403);
  });

  it('No API to change entries', async () => {
    const admin = await createAndSignInAdmin(app);
    const doctor = await registerDoctor(app);
    await admin.agent.post(`/api/admin/doctors/${doctor.id}/approve`).send({}).expect(200);
    const list = await admin.agent.get('/api/admin/audit').query({ entityId: doctor.id }).expect(200);
    const entryId = list.body.items[0].id as string;

    const patch = await admin.agent.patch(`/api/admin/audit/${entryId}`).send({ reason: 'tampered' });
    const put = await admin.agent.put(`/api/admin/audit/${entryId}`).send({ reason: 'tampered' });
    const del = await admin.agent.delete(`/api/admin/audit/${entryId}`);

    expect([404, 405]).toContain(patch.status);
    expect([404, 405]).toContain(put.status);
    expect([404, 405]).toContain(del.status);
  });
});
