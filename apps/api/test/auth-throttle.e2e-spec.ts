import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './support/test-app.js';
import { resetDatabase } from './support/reset-db.js';
import { uniqueEmail } from './support/auth-helpers.js';

// A fresh, isolated app instance (own RateLimitGuard counters) so tripping the
// limit here can't affect any other e2e test file's login/registration calls.
describe('Rate limiting', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await resetDatabase();
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('Too many attempts', async () => {
    const email = uniqueEmail('throttle');
    const password = 'correct-horse-battery';

    // The 10 login attempts below (all with a wrong password) exhaust the
    // per-minute limit; the 11th must be rejected before it even runs.
    for (let i = 0; i < 10; i += 1) {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email, password: 'wrong-password' });
      expect(res.status).toBe(401);
    }

    const eleventh = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password });

    expect(eleventh.status).toBe(429);
  });
});
