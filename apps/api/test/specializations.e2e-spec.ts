import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './support/test-app.js';

const EXPECTED_SLUGS = [
  'general-practice',
  'internal-medicine',
  'pediatrics',
  'dermatology',
  'cardiology',
  'neurology',
  'psychiatry',
  'obstetrics-gynecology',
  'ent',
  'orthopedics',
  'gastroenterology',
  'pulmonology',
  'endocrinology',
];

describe('Specialization catalog', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('Catalog available after migration', async () => {
    const res = await request(app.getHttpServer()).get('/api/specializations');

    expect(res.status).toBe(200);
    const slugs = res.body.map((s: { slug: string }) => s.slug).sort();
    expect(slugs).toEqual([...EXPECTED_SLUGS].sort());
    for (const specialization of res.body) {
      expect(specialization).toMatchObject({
        id: expect.any(String),
        slug: expect.any(String),
        name: expect.any(String),
        description: expect.any(String),
      });
    }
  });

  it('Visitor lists specializations', async () => {
    const res = await request(app.getHttpServer()).get('/api/specializations');

    expect(res.status).toBe(200);
    const names = res.body.map((s: { name: string }) => s.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it('Write attempt', async () => {
    const post = await request(app.getHttpServer()).post('/api/specializations').send({ name: 'Hacked' });
    const patch = await request(app.getHttpServer())
      .patch('/api/specializations/00000000-0000-4000-8000-000000000000')
      .send({ name: 'Hacked' });
    const del = await request(app.getHttpServer()).delete(
      '/api/specializations/00000000-0000-4000-8000-000000000000',
    );

    expect([404, 405]).toContain(post.status);
    expect([404, 405]).toContain(patch.status);
    expect([404, 405]).toContain(del.status);

    const list = await request(app.getHttpServer()).get('/api/specializations');
    expect(list.body).toHaveLength(EXPECTED_SLUGS.length);
  });
});
