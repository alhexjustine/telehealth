import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');

/**
 * Spawns the real compiled server (mirroring `health.e2e-spec.ts`'s pattern)
 * with logging turned up, so this observes the actual stdout a deployed
 * container would produce — not just the pino config in isolation.
 */
describe('Password never exposed in logs', () => {
  const port = 41567;
  let child: ChildProcessWithoutNullStreams;
  let stdout = '';

  beforeAll(async () => {
    const entry = resolve(__dirname, '../dist/src/main.js');
    child = spawn(process.execPath, [entry], {
      env: {
        ...process.env,
        PORT: String(port),
        NODE_ENV: 'production',
        LOG_LEVEL: 'info',
        DATABASE_URL:
          process.env.DATABASE_URL ??
          'postgresql://telehealth:telehealth@localhost:5432/telehealth_test?schema=public',
      },
      stdio: 'pipe',
    });
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    await waitForServer(`http://127.0.0.1:${port}/api/health`, 15000);
  });

  afterAll(() => {
    child.kill();
  });

  it('Password never exposed', async () => {
    const secretPassword = 'S3cretPassw0rd!ThatMustNeverAppear';
    await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'nobody@example.com', password: secretPassword }),
    });

    // Give pino-http a moment to flush the access log line for that request.
    await new Promise((r) => setTimeout(r, 300));

    expect(stdout).not.toContain(secretPassword);
    expect(stdout.toLowerCase()).not.toMatch(/"password":"/);
    expect(stdout.toLowerCase()).not.toMatch(/"passwordhash":"/);
  }, 20000);
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
