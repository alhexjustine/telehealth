import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './support/test-app.js';

describe('Consistent API error responses', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('Unknown API route', async () => {
    const response = await request(app.getHttpServer()).get('/api/this-route-does-not-exist');

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ statusCode: 404, error: 'Not Found' });
    expect(typeof response.body.requestId).toBe('string');
    expect(response.body.requestId.length).toBeGreaterThan(0);
    expect(response.headers['x-request-id']).toBe(response.body.requestId);
  });
});
