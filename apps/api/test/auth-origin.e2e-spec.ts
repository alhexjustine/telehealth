import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './support/test-app.js';
import { resetDatabase } from './support/reset-db.js';
import { uniqueEmail } from './support/auth-helpers.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Cross-origin request protection', () => {
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

  it('Foreign origin', async () => {
    const email = uniqueEmail('foreign-origin');
    const res = await request(app.getHttpServer())
      .post('/api/auth/register/patient')
      .set('Origin', 'https://evil.example')
      .send({ email, password: 'correct-horse-battery', firstName: 'Ada', lastName: 'Lovelace' });

    expect(res.status).toBe(403);
    const stored = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    expect(stored).toBeNull();
  });

  it('Application origin', async () => {
    const email = uniqueEmail('app-origin');
    const res = await request(app.getHttpServer())
      .post('/api/auth/register/patient')
      .set('Origin', 'http://localhost:8080')
      .send({ email, password: 'correct-horse-battery', firstName: 'Ada', lastName: 'Lovelace' });

    expect(res.status).toBe(201);
  });
});
