import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './support/test-app.js';

describe('Request traceability', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('Client supplies a request ID', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/health')
      .set('X-Request-Id', 'abc-123');

    expect(response.headers['x-request-id']).toBe('abc-123');
  });

  it('Client omits a request ID', async () => {
    const response = await request(app.getHttpServer()).get('/api/health');

    const requestId = response.headers['x-request-id'] as string | undefined;

    expect(typeof requestId).toBe('string');
    expect(requestId?.length).toBeGreaterThan(0);
  });
});
