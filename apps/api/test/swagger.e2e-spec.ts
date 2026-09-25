import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './support/test-app.js';

describe('API reference generated from the implementation', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('Reference reflects the API: /api/docs renders the Swagger UI', async () => {
    const response = await request(app.getHttpServer()).get('/api/docs');

    expect(response.status).toBe(200);
    expect(response.text).toContain('swagger-ui');
  });

  it('Reference reflects the API: /api/docs-json lists GET /api/health', async () => {
    const response = await request(app.getHttpServer()).get('/api/docs-json');

    expect(response.status).toBe(200);
    expect(response.body.servers).toContainEqual(expect.objectContaining({ url: '/api' }));
    expect(response.body.paths).toHaveProperty('/health');
    expect(response.body.paths['/health']).toHaveProperty('get');
  });
});
