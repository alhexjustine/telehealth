import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './support/test-app.js';
import { resetDatabase } from './support/reset-db.js';
import { registerPatient, uniqueEmail } from './support/auth-helpers.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Sign-in', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    await resetDatabase();
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('Valid credentials', async () => {
    const email = uniqueEmail('signin');
    const password = 'correct-horse-battery';
    await registerPatient(app, { email, password });

    const res = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ email: email.toLowerCase(), role: 'PATIENT' });
    expect(res.headers['set-cookie']?.[0]).toContain('th_session=');
  });

  it('Wrong password or unknown email', async () => {
    const email = uniqueEmail('wrongpw');
    const password = 'correct-horse-battery';
    await registerPatient(app, { email, password });

    const wrongPassword = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: 'incorrect-password' });
    const unknownEmail = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: uniqueEmail('nobody'), password: 'whatever-password' });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.message).toBe(unknownEmail.body.message);
    expect(wrongPassword.headers['set-cookie']).toBeUndefined();
  });

  it('Suspended or deactivated account', async () => {
    const email = uniqueEmail('suspended');
    const password = 'correct-horse-battery';
    const { id } = await registerPatient(app, { email, password });
    await prisma.user.update({ where: { id }, data: { status: 'SUSPENDED' } });

    const res = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password });

    expect(res.status).toBe(403);
  });
});
