import { forwardRef, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { SESSION_REALTIME_NOTIFIER } from '../auth/session/session-realtime-notifier.js';
import { RealtimeGateway } from './realtime.gateway.js';

/**
 * `AuthModule` and `RealtimeModule` depend on each other at the Nest-module
 * level (`SessionService` disconnects sockets on revocation; the gateway
 * validates sessions on handshake), so both sides import each other via
 * `forwardRef` — the standard Nest pattern for a two-way module dependency.
 * `SessionService` itself is injected with `RealtimeGateway` bound to the
 * `SESSION_REALTIME_NOTIFIER` token rather than the class directly — see
 * `session-realtime-notifier.ts` for why (a genuine ES-module import cycle,
 * which `forwardRef` alone doesn't fix for a class used as a constructor
 * parameter's TS type). `PrismaService` is injected directly into the
 * gateway without importing `PrismaModule` because it's `@Global()`.
 */
@Module({
  imports: [forwardRef(() => AuthModule)],
  providers: [RealtimeGateway, { provide: SESSION_REALTIME_NOTIFIER, useExisting: RealtimeGateway }],
  exports: [RealtimeGateway, SESSION_REALTIME_NOTIFIER],
})
export class RealtimeModule {}
