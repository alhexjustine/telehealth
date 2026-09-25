/**
 * The narrow interface `SessionService` needs from the realtime gateway, and
 * the DI token it's injected under. Using a token + interface instead of
 * importing `RealtimeGateway` directly breaks what would otherwise be a
 * genuine ES-module import cycle (`session.service.ts` -> `realtime.gateway.ts`
 * -> `session.service.ts`): with `emitDecoratorMetadata` on, a constructor
 * parameter typed as a real (circularly-imported) class throws
 * `ReferenceError: Cannot access '<Class>' before initialization` the moment
 * either file evaluates first, even behind `forwardRef`. `RealtimeModule`
 * provides this token (`useExisting: RealtimeGateway`); `AuthModule` only
 * ever imports this file, never `realtime.gateway.ts`.
 */
export interface SessionRealtimeNotifier {
  disconnectSessions(sessionIds: readonly string[]): void;
}

export const SESSION_REALTIME_NOTIFIER = Symbol('SESSION_REALTIME_NOTIFIER');
