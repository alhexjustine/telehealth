import { afterEach, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './support/test-app.js';
import { resetDatabase } from './support/reset-db.js';
import { uniqueEmail } from './support/auth-helpers.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Patient registration', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    await resetDatabase();
  });

  // A fresh app per test isolates each test's own registration rate-limit
  // counter (the endpoint is limited to 5/minute/IP, and some tests below make
  // more than one call to it).
  beforeEach(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterEach(async () => {
    await app.close();
  });

  it('Successful patient registration', async () => {
    const email = uniqueEmail('patient');
    const res = await request(app.getHttpServer())
      .post('/api/auth/register/patient')
      .send({ email, password: 'correct-horse-battery', firstName: 'Ada', lastName: 'Lovelace' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ email, role: 'PATIENT' });
    expect(res.body.id).toEqual(expect.any(String));
    expect(res.body).not.toHaveProperty('password');
    expect(res.body).not.toHaveProperty('passwordHash');
    expect(res.headers['set-cookie']?.[0]).toContain('th_session=');

    const stored = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    expect(stored?.status).toBe('ACTIVE');
  });

  it('Email already registered', async () => {
    const email = uniqueEmail('dup');
    await request(app.getHttpServer())
      .post('/api/auth/register/patient')
      .send({ email, password: 'correct-horse-battery', firstName: 'Ada', lastName: 'Lovelace' })
      .expect(201);

    const before = await prisma.user.count();
    const res = await request(app.getHttpServer())
      .post('/api/auth/register/patient')
      .send({
        email: email.toUpperCase(),
        password: 'another-password',
        firstName: 'Someone',
        lastName: 'Else',
      });

    expect(res.status).toBe(409);
    expect(await prisma.user.count()).toBe(before);
  });

  it('Invalid registration input', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register/patient')
      .send({ email: 'not-an-email', password: 'correct-horse-battery', firstName: 'Ada', lastName: 'Lovelace' });

    expect(res.status).toBe(400);
  });

  it('Password too short', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register/patient')
      .send({ email: uniqueEmail('short'), password: 'short12', firstName: 'Ada', lastName: 'Lovelace' });

    expect(res.status).toBe(400);
    expect(String(res.body.message)).toMatch(/password/i);
  });

  it('No public admin creation', async () => {
    const email = uniqueEmail('wannabe-admin');
    const res = await request(app.getHttpServer()).post('/api/auth/register/patient').send({
      email,
      password: 'correct-horse-battery',
      firstName: 'Ada',
      lastName: 'Lovelace',
      role: 'ADMIN',
    });

    expect(res.status).toBe(400);
    const stored = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    expect(stored).toBeNull();
  });
});
