import { afterEach, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './support/test-app.js';
import { resetDatabase } from './support/reset-db.js';
import { createAndSignInAdmin, registerDoctor, registerPatient } from './support/auth-helpers.js';
import { registerBookableDoctor } from './support/appointment-helpers.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { PasswordHasherService } from '../src/auth/password/password-hasher.service.js';
import { AccountStatus, Role, VerificationStatus } from '../src/generated/prisma/enums.js';

async function setAccountStatus(app: INestApplication, userId: string, status: AccountStatus): Promise<void> {
  const prisma = app.get(PrismaService);
  await prisma.user.update({ where: { id: userId }, data: { status } });
}

async function rejectDoctor(app: INestApplication, doctorId: string): Promise<void> {
  const prisma = app.get(PrismaService);
  await prisma.doctorProfile.update({
    where: { userId: doctorId },
    data: { verificationStatus: VerificationStatus.REJECTED },
  });
}

/**
 * Creates an already-approved, visible doctor directly via Prisma, bypassing
 * the public registration endpoint's 5/minute/IP rate limit — used only by
 * the favorite-limit test, which needs 51 doctors in a single app instance.
 */
async function createVisibleDoctorDirect(app: INestApplication, index: number): Promise<string> {
  const prisma = app.get(PrismaService);
  const hasher = app.get(PasswordHasherService);
  const passwordHash = await hasher.hash('correct-horse-battery');
  const user = await prisma.user.create({
    data: { email: `favorite-limit-${Date.now()}-${index}@example.com`, passwordHash, role: Role.DOCTOR },
  });
  await prisma.doctorProfile.create({
    data: {
      userId: user.id,
      firstName: 'Doc',
      lastName: `Number${index}`,
      licenseNumber: `LIC-FAV-${Date.now()}-${index}`,
      verificationStatus: VerificationStatus.APPROVED,
    },
  });
  return user.id;
}

describe('Doctor favorites', () => {
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

  it('Favorite an approved doctor', async () => {
    const patient = await registerPatient(app);
    const doctor = await registerBookableDoctor(app);

    const res = await patient.agent
      .post('/api/patients/me/favorites')
      .send({ doctorId: doctor.id })
      .expect(201);

    expect(res.body.doctorId).toBe(doctor.id);
    expect(typeof res.body.favoritedAt).toBe('string');

    const list = await patient.agent.get('/api/patients/me/favorites').expect(200);
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0].id).toBe(doctor.id);
  });

  it('Favoriting again is a no-op', async () => {
    const patient = await registerPatient(app);
    const doctor = await registerBookableDoctor(app);

    await patient.agent.post('/api/patients/me/favorites').send({ doctorId: doctor.id }).expect(201);
    await patient.agent.post('/api/patients/me/favorites').send({ doctorId: doctor.id }).expect(200);

    const list = await patient.agent.get('/api/patients/me/favorites').expect(200);
    expect(list.body.items).toHaveLength(1);
  });

  it('Cannot favorite a hidden doctor', async () => {
    const patient = await registerPatient(app);
    const pendingDoctor = await registerDoctor(app);

    const res = await patient.agent.post('/api/patients/me/favorites').send({ doctorId: pendingDoctor.id });
    expect(res.status).toBe(404);
  });

  it('Favorite limit reached', async () => {
    const patient = await registerPatient(app);
    for (let i = 0; i < 50; i += 1) {
      const doctorId = await createVisibleDoctorDirect(app, i);
      await patient.agent.post('/api/patients/me/favorites').send({ doctorId }).expect(201);
    }

    const oneMoreId = await createVisibleDoctorDirect(app, 50);
    const res = await patient.agent.post('/api/patients/me/favorites').send({ doctorId: oneMoreId });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('FAVORITE_LIMIT_REACHED');
  }, 30_000);

  it('Non-patient denied', async () => {
    const doctor = await registerBookableDoctor(app);
    const otherDoctor = await registerDoctor(app);
    const admin = await createAndSignInAdmin(app);

    await otherDoctor.agent.post('/api/patients/me/favorites').send({ doctorId: doctor.id }).expect(403);
    await admin.agent.post('/api/patients/me/favorites').send({ doctorId: doctor.id }).expect(403);
  });

  it('Signed-out denied (favorite)', async () => {
    const doctor = await registerBookableDoctor(app);
    const res = await request(app.getHttpServer())
      .post('/api/patients/me/favorites')
      .send({ doctorId: doctor.id });
    expect(res.status).toBe(401);
  });

  it('Unfavorite a favorited doctor', async () => {
    const patient = await registerPatient(app);
    const doctor = await registerBookableDoctor(app);

    await patient.agent.post('/api/patients/me/favorites').send({ doctorId: doctor.id }).expect(201);
    await patient.agent.delete(`/api/patients/me/favorites/${doctor.id}`).expect(204);

    const list = await patient.agent.get('/api/patients/me/favorites').expect(200);
    expect(list.body.items).toHaveLength(0);
  });

  it('Unfavoriting an unfavorited doctor is a no-op', async () => {
    const patient = await registerPatient(app);
    const doctor = await registerBookableDoctor(app);

    await patient.agent.delete(`/api/patients/me/favorites/${doctor.id}`).expect(204);
  });

  it('Signed-out denied (unfavorite)', async () => {
    const doctor = await registerBookableDoctor(app);
    const res = await request(app.getHttpServer()).delete(`/api/patients/me/favorites/${doctor.id}`);
    expect(res.status).toBe(401);
  });

  it('List favorites with live summaries', async () => {
    const patient = await registerPatient(app);
    const doctor = await registerBookableDoctor(app, { firstName: 'Grace', lastName: 'Hopper' });

    await patient.agent.post('/api/patients/me/favorites').send({ doctorId: doctor.id }).expect(201);

    const list = await patient.agent.get('/api/patients/me/favorites').expect(200);
    expect(list.body.items).toHaveLength(1);
    const entry = list.body.items[0];
    expect(entry.displayName).toBe('Grace Hopper');
    expect(entry.acceptingBookings).toBe(true);
    expect(typeof entry.favoritedAt).toBe('string');
  });

  it('Favorite doctor no longer visible', async () => {
    const patient = await registerPatient(app);
    const doctor = await registerBookableDoctor(app);

    await patient.agent.post('/api/patients/me/favorites').send({ doctorId: doctor.id }).expect(201);
    await setAccountStatus(app, doctor.id, AccountStatus.SUSPENDED);

    const list = await patient.agent.get('/api/patients/me/favorites').expect(200);
    expect(list.body.items).toHaveLength(0);
  });

  it('Favorite doctor later rejected is silently dropped', async () => {
    const patient = await registerPatient(app);
    const doctor = await registerBookableDoctor(app);

    await patient.agent.post('/api/patients/me/favorites').send({ doctorId: doctor.id }).expect(201);
    await rejectDoctor(app, doctor.id);

    const list = await patient.agent.get('/api/patients/me/favorites').expect(200);
    expect(list.body.items).toHaveLength(0);
  });

  it('Empty favorites', async () => {
    const patient = await registerPatient(app);
    const res = await patient.agent.get('/api/patients/me/favorites').expect(200);
    expect(res.body.items).toEqual([]);
  });

  it('Signed-out denied (list)', async () => {
    const res = await request(app.getHttpServer()).get('/api/patients/me/favorites');
    expect(res.status).toBe(401);
  });

  it('Favoriting does not reorder search results', async () => {
    const patient = await registerPatient(app);
    // A unique surname scopes the `q` search to just these two doctors,
    // regardless of how many other doctors earlier tests in this file left
    // in the (only-reset-once) database.
    const suffix = `Reorder${Date.now()}`;
    const doctorA = await registerBookableDoctor(app, { firstName: 'Ada', lastName: suffix });
    const doctorB = await registerBookableDoctor(app, { firstName: 'Grace', lastName: suffix });

    const before = await patient.agent.get(`/api/doctors?q=${suffix}`).expect(200);
    const ids = (before.body.items as Array<{ id: string }>).map((item) => item.id);
    expect(ids).toEqual(expect.arrayContaining([doctorA.id, doctorB.id]));

    await patient.agent.post('/api/patients/me/favorites').send({ doctorId: doctorB.id }).expect(201);

    const after = await patient.agent.get(`/api/doctors?q=${suffix}`).expect(200);
    expect(after.body).toEqual(before.body);
  });
});
