import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './support/test-app.js';
import { resetDatabase } from './support/reset-db.js';
import { uniqueEmail } from './support/auth-helpers.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Doctor registration', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let specializationId: string;

  beforeAll(async () => {
    await resetDatabase();
    app = await createTestApp();
    prisma = app.get(PrismaService);
    const list = await request(app.getHttpServer()).get('/api/specializations').expect(200);
    specializationId = list.body[0].id as string;
  });

  afterAll(async () => {
    await app.close();
  });

  it('Successful doctor registration', async () => {
    const email = uniqueEmail('doctor');
    const res = await request(app.getHttpServer())
      .post('/api/auth/register/doctor')
      .send({
        email,
        password: 'correct-horse-battery',
        firstName: 'Grace',
        lastName: 'Hopper',
        specializationIds: [specializationId],
        licenseNumber: 'LIC-0001',
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ email, role: 'DOCTOR' });

    const profile = await prisma.doctorProfile.findUnique({ where: { licenseNumber: 'LIC-0001' } });
    expect(profile?.verificationStatus).toBe('PENDING');
  });

  it('Unknown specialization', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register/doctor')
      .send({
        email: uniqueEmail('bad-spec'),
        password: 'correct-horse-battery',
        firstName: 'Grace',
        lastName: 'Hopper',
        specializationIds: ['00000000-0000-4000-8000-000000000000'],
        licenseNumber: 'LIC-0002',
      });

    expect(res.status).toBe(400);
  });

  it('License number already used', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register/doctor')
      .send({
        email: uniqueEmail('dup-license'),
        password: 'correct-horse-battery',
        firstName: 'Someone',
        lastName: 'Else',
        specializationIds: [specializationId],
        licenseNumber: 'LIC-0001',
      });

    expect(res.status).toBe(409);
  });

  it('No public admin creation', async () => {
    const email = uniqueEmail('doctor-wannabe-admin');
    const res = await request(app.getHttpServer())
      .post('/api/auth/register/doctor')
      .send({
        email,
        password: 'correct-horse-battery',
        firstName: 'Grace',
        lastName: 'Hopper',
        specializationIds: [specializationId],
        licenseNumber: 'LIC-0003',
        role: 'ADMIN',
      });

    expect(res.status).toBe(400);
    const stored = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    expect(stored).toBeNull();
  });
});
