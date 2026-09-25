import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './support/test-app.js';
import { resetDatabase } from './support/reset-db.js';
import { createAndSignInAdmin, registerDoctor, registerPatient } from './support/auth-helpers.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { SessionService } from '../src/auth/session/session.service.js';

describe('Deny-by-default access control', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let patient: Awaited<ReturnType<typeof registerPatient>>;
  let doctor: Awaited<ReturnType<typeof registerDoctor>>;
  let admin: Awaited<ReturnType<typeof createAndSignInAdmin>>;

  beforeAll(async () => {
    await resetDatabase();
    app = await createTestApp();
    prisma = app.get(PrismaService);
    patient = await registerPatient(app);
    doctor = await registerDoctor(app);
    admin = await createAndSignInAdmin(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('Protected endpoint without a session', async () => {
    const res = await request(app.getHttpServer()).get('/api/test/roles/any-signed-in');
    expect(res.status).toBe(401);
  });

  it('Public endpoint without a session', async () => {
    const health = await request(app.getHttpServer()).get('/api/health');
    const catalog = await request(app.getHttpServer()).get('/api/specializations');
    expect(health.status).toBe(200);
    expect(catalog.status).toBe(200);
  });

  it('Wrong role', async () => {
    const doctorOnPatientRoute = await doctor.agent.get('/api/test/roles/patient-only');
    const patientOnDoctorRoute = await patient.agent.get('/api/test/roles/doctor-only');
    const patientOnAdminRoute = await patient.agent.get('/api/test/roles/admin-only');

    expect(doctorOnPatientRoute.status).toBe(403);
    expect(patientOnDoctorRoute.status).toBe(403);
    expect(patientOnAdminRoute.status).toBe(403);
  });

  it('Admin-only endpoint', async () => {
    const res = await admin.agent.get('/api/test/roles/admin-only');
    expect(res.status).toBe(200);
  });

  it('Authenticated request', async () => {
    const res = await patient.agent.get('/api/test/roles/any-signed-in');
    expect(res.status).toBe(200);
  });

  it('Expired session', async () => {
    const user = await registerPatient(app);
    await prisma.session.updateMany({
      where: { userId: user.id },
      data: { createdAt: new Date(Date.now() - 13 * 60 * 60 * 1000) },
    });

    const res = await user.agent.get('/api/test/roles/any-signed-in');
    expect(res.status).toBe(401);
  });

  it('Background re-validation does not extend an idle session', async () => {
    const user = await registerPatient(app);
    const staleLastUsedAt = new Date(Date.now() - 30 * 60 * 1000);
    await prisma.session.updateMany({ where: { userId: user.id }, data: { lastUsedAt: staleLastUsedAt } });

    const validated = await app.get(SessionService).validateSession(user.token, { countsAsActivity: false });
    expect(validated).not.toBeNull();

    const [session] = await prisma.session.findMany({ where: { userId: user.id } });
    expect(session?.lastUsedAt.getTime()).toBe(staleLastUsedAt.getTime());
  });

  it('Tampered or unknown token', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/test/roles/any-signed-in')
      .set('Cookie', 'th_session=not-a-real-token');
    expect(res.status).toBe(401);
  });

  it('Account suspended while signed in', async () => {
    const user = await registerPatient(app);
    await prisma.user.update({ where: { id: user.id }, data: { status: 'SUSPENDED' } });

    const res = await user.agent.get('/api/test/roles/any-signed-in');
    expect(res.status).toBe(401);

    const sessions = await prisma.session.findMany({ where: { userId: user.id } });
    expect(sessions.every((session) => session.revokedAt !== null)).toBe(true);
  });
});
