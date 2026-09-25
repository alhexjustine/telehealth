import type { AddressInfo } from 'node:net';
import type { INestApplication } from '@nestjs/common';

/**
 * Socket.io tests need a real listening port (the gateway sits on the same
 * HTTP server, outside `/api`) — `createTestApp` alone never calls `listen`.
 * Supertest keeps working against the same app afterward: it reuses an
 * already-listening server instead of starting its own.
 */
export async function listenOnEphemeralPort(app: INestApplication): Promise<{ port: number; baseUrl: string }> {
  await app.listen(0);
  const address = app.getHttpServer().address() as AddressInfo;
  return { port: address.port, baseUrl: `http://127.0.0.1:${address.port}` };
}
