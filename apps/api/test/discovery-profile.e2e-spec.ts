import { afterEach, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './support/test-app.js';
import { resetDatabase } from './support/reset-db.js';
import { registerDoctor, registerPatient } from './support/auth-helpers.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { AccountStatus, VerificationStatus } from '../src/generated/prisma/enums.js';

async function approveDoctor(app: INestApplication, doctorId: string): Promise<void> {
  const prisma = app.get(PrismaService);
  await prisma.doctorProfile.update({
    where: { userId: doctorId },
    data: { verificationStatus: VerificationStatus.APPROVED },
  });
}

async function setAccountStatus(
  app: INestApplication,
  userId: string,
  status: AccountStatus,
): Promise<void> {
  const prisma = app.get(PrismaService);
  await prisma.user.update({ where: { id: userId }, data: { status } });
}

describe('Doctor public profile', () => {
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

  it('View approved doctor', async () => {
    const doctor = await registerDoctor(app, { firstName: 'Grace', lastName: 'Hopper' });
    await approveDoctor(app, doctor.id);

    const patient = await registerPatient(app);
    const res = await patient.agent.get(`/api/doctors/${doctor.id}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: doctor.id,
      displayName: 'Grace Hopper',
    });
    expect(res.body.specializations.length).toBeGreaterThan(0);
    expect(res.body).not.toHaveProperty('email');
    expect(res.body).not.toHaveProperty('licenseNumber');
    expect(res.body).not.toHaveProperty('reviewNote');
    expect(JSON.stringify(res.body)).not.toContain(doctor.email);
  });

  it('Hidden doctor', async () => {
    const patient = await registerPatient(app);

    const pendingDoctor = await registerDoctor(app);
    const pendingRes = await patient.agent.get(`/api/doctors/${pendingDoctor.id}`);
    expect(pendingRes.status).toBe(404);

    const rejectedDoctor = await registerDoctor(app);
    await approveDoctor(app, rejectedDoctor.id);
    await app.get(PrismaService).doctorProfile.update({
      where: { userId: rejectedDoctor.id },
      data: { verificationStatus: VerificationStatus.REJECTED },
    });
    const rejectedRes = await patient.agent.get(`/api/doctors/${rejectedDoctor.id}`);
    expect(rejectedRes.status).toBe(404);

    const suspendedDoctor = await registerDoctor(app);
    await approveDoctor(app, suspendedDoctor.id);
    await setAccountStatus(app, suspendedDoctor.id, AccountStatus.SUSPENDED);
    const suspendedRes = await patient.agent.get(`/api/doctors/${suspendedDoctor.id}`);
    expect(suspendedRes.status).toBe(404);

    const notADoctorRes = await patient.agent.get(`/api/doctors/${patient.id}`);
    expect(notADoctorRes.status).toBe(404);
  });

  it('Not accepting bookings shown on profile', async () => {
    const doctor = await registerDoctor(app);
    await approveDoctor(app, doctor.id);
    await doctor.agent.patch('/api/doctors/me/profile').send({ acceptingBookings: false }).expect(200);

    const patient = await registerPatient(app);
    const res = await patient.agent.get(`/api/doctors/${doctor.id}`);

    expect(res.status).toBe(200);
    expect(res.body.acceptingBookings).toBe(false);
  });

  it('Doctor views own profile regardless of status', async () => {
    const doctor = await registerDoctor(app);
    const res = await doctor.agent.get(`/api/doctors/${doctor.id}`);
    expect(res.status).toBe(200);
  });

  it('Signed-out denied (profile)', async () => {
    const doctor = await registerDoctor(app);
    await approveDoctor(app, doctor.id);
    const res = await request(app.getHttpServer()).get(`/api/doctors/${doctor.id}`);
    expect(res.status).toBe(401);
  });
});
