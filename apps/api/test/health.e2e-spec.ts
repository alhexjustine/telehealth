import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './support/test-app.js';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');

describe('Health reporting', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('Database reachable', async () => {
    const response = await request(app.getHttpServer()).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.details.database.status).toBe('up');
  });

  it('No sensitive data exposed', async () => {
    const response = await request(app.getHttpServer()).get('/api/health');
    const raw = JSON.stringify(response.body);

    expect(raw).not.toMatch(/postgres(ql)?:\/\//i);
    if (process.env.DATABASE_URL) {
      expect(raw).not.toContain(process.env.DATABASE_URL);
    }
    expect(response.body).not.toHaveProperty('config');
  });

  describe('when the database is unreachable', () => {
    const port = 41234;
    let child: ChildProcessWithoutNullStreams;

    beforeAll(() => {
      const entry = resolve(__dirname, '../dist/src/main.js');
      child = spawn(process.execPath, [entry], {
        env: {
          ...process.env,
          PORT: String(port),
          DATABASE_URL: 'postgresql://telehealth:telehealth@127.0.0.1:5999/telehealth_test',
          LOG_LEVEL: 'silent',
        },
        stdio: 'pipe',
      });
    });

    afterAll(() => {
      child.kill();
    });

    it('Database unreachable', async () => {
      const response = await waitForServer(`http://127.0.0.1:${port}/api/health`, 15000);
      const body = (await response.json()) as { details: { database: { status: string } } };

      expect(response.status).toBe(503);
      expect(body.details.database.status).toBe('down');
    }, 20000);
  });
});

async function waitForServer(url: string, timeoutMs: number): Promise<Response> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      return await fetch(url);
    } catch (error) {
      lastError = error;
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  throw lastError;
}
