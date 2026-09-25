import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './support/test-app.js';
import { resetDatabase } from './support/reset-db.js';
import { registerPatient } from './support/auth-helpers.js';

describe('Sign-out and password change', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await resetDatabase();
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('Sign out of this device', async () => {
    const user = await registerPatient(app);

    const logout = await user.agent.post('/api/auth/logout');
    expect(logout.status).toBe(204);
    expect(logout.headers['set-cookie']?.[0]).toMatch(/th_session=;/);

    const after = await user.agent.get('/api/auth/me');
    expect(after.status).toBe(401);
  });

  it('Sign out everywhere', async () => {
    const user = await registerPatient(app);
    // A second "device" signed in with the same credentials.
    const otherDevice = request.agent(app.getHttpServer());
    await otherDevice.post('/api/auth/login').send({ email: user.email, password: user.password }).expect(200);

    await user.agent.post('/api/auth/logout-all').expect(204);

    const thisDevice = await user.agent.get('/api/auth/me');
    const other = await otherDevice.get('/api/auth/me');
    expect(thisDevice.status).toBe(401);
    expect(other.status).toBe(401);
  });

  it('Sign-out without a session', async () => {
    const res = await request(app.getHttpServer()).post('/api/auth/logout');
    expect(res.status).toBe(401);
  });

  it('Successful password change', async () => {
    const user = await registerPatient(app);
    const otherDevice = request.agent(app.getHttpServer());
    await otherDevice.post('/api/auth/login').send({ email: user.email, password: user.password }).expect(200);

    const res = await user.agent
      .post('/api/auth/password')
      .send({ currentPassword: user.password, newPassword: 'a-brand-new-password' });
    expect(res.status).toBe(204);

    const oldPasswordLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: user.email, password: user.password });
    expect(oldPasswordLogin.status).toBe(401);

    const newPasswordLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: user.email, password: 'a-brand-new-password' });
    expect(newPasswordLogin.status).toBe(200);

    // The device that changed the password keeps working; the other device does not.
    const currentDeviceStillWorks = await user.agent.get('/api/auth/me');
    const otherDeviceRevoked = await otherDevice.get('/api/auth/me');
    expect(currentDeviceStillWorks.status).toBe(200);
    expect(otherDeviceRevoked.status).toBe(401);
  });

  it('Wrong current password', async () => {
    const user = await registerPatient(app);
    const res = await user.agent
      .post('/api/auth/password')
      .send({ currentPassword: 'not-the-right-password', newPassword: 'a-brand-new-password' });

    expect(res.status).toBe(403);

    const stillWorks = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: user.email, password: user.password });
    expect(stillWorks.status).toBe(200);
  });
});
