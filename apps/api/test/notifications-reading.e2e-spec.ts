import { afterEach, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './support/test-app.js';
import { resetDatabase } from './support/reset-db.js';
import { registerPatient } from './support/auth-helpers.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { NotificationType } from '../src/generated/prisma/enums.js';

describe('Reading notifications', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    await resetDatabase();
  });

  beforeEach(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterEach(async () => {
    await app.close();
  });

  async function createNotification(userId: string, overrides: { readAt?: Date | null; title?: string } = {}) {
    return prisma.notification.create({
      data: {
        userId,
        type: NotificationType.APPOINTMENT_BOOKED,
        title: overrides.title ?? 'New booking',
        body: 'New booking with someone',
        readAt: overrides.readAt ?? null,
      },
    });
  }

  it('List own notifications', async () => {
    const patient = await registerPatient(app);
    await createNotification(patient.id, { title: 'Unread one' });
    await createNotification(patient.id, { title: 'Unread two' });
    await createNotification(patient.id, { title: 'Already read', readAt: new Date() });

    const res = await patient.agent.get('/api/notifications').query({ unreadOnly: true }).expect(200);

    expect(res.body.items).toHaveLength(2);
    expect(res.body.unreadCount).toBe(2);
    const titles = res.body.items.map((n: { title: string }) => n.title);
    expect(titles).toEqual(['Unread two', 'Unread one']); // newest first
  });

  it('An explicit unreadOnly=false still returns read notifications too', async () => {
    const patient = await registerPatient(app);
    await createNotification(patient.id, { title: 'Unread one' });
    await createNotification(patient.id, { title: 'Already read', readAt: new Date() });

    // The web app always sends this explicitly (never omits the param) — a
    // regression test for `unreadOnly` query-string "false" being coerced to
    // the boolean `true` (see the DTO's `@Transform` comment).
    const res = await patient.agent.get('/api/notifications').query({ unreadOnly: false }).expect(200);

    expect(res.body.items).toHaveLength(2);
  });

  it('Mark one read', async () => {
    const patient = await registerPatient(app);
    const notification = await createNotification(patient.id);

    const before = await patient.agent.get('/api/notifications/unread-count').expect(200);
    expect(before.body.unreadCount).toBe(1);

    const res = await patient.agent.post(`/api/notifications/${notification.id}/read`).expect(200);
    expect(res.body.readAt).not.toBeNull();

    const after = await patient.agent.get('/api/notifications/unread-count').expect(200);
    expect(after.body.unreadCount).toBe(0);
  });

  it('Mark all read', async () => {
    const patient = await registerPatient(app);
    const otherPatient = await registerPatient(app);
    await createNotification(patient.id);
    await createNotification(patient.id);
    await createNotification(otherPatient.id);

    await patient.agent.post('/api/notifications/read-all').expect(204);

    const ownCount = await patient.agent.get('/api/notifications/unread-count').expect(200);
    expect(ownCount.body.unreadCount).toBe(0);

    const otherCount = await otherPatient.agent.get('/api/notifications/unread-count').expect(200);
    expect(otherCount.body.unreadCount).toBe(1);
  });

  it("Another user's notification", async () => {
    const patient = await registerPatient(app);
    const otherPatient = await registerPatient(app);
    const notification = await createNotification(otherPatient.id);

    const res = await patient.agent.post(`/api/notifications/${notification.id}/read`);
    expect(res.status).toBe(404);

    const unchanged = await prisma.notification.findUnique({ where: { id: notification.id } });
    expect(unchanged!.readAt).toBeNull();
  });

  it('Signed-out denied (notifications)', async () => {
    const list = await request(app.getHttpServer()).get('/api/notifications').query({ scope: 'all' });
    expect(list.status).toBe(401);

    const unreadCount = await request(app.getHttpServer()).get('/api/notifications/unread-count');
    expect(unreadCount.status).toBe(401);
  });
});
