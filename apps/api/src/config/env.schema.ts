import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  // Comma-separated list of origins allowed to make state-changing requests.
  APP_ORIGINS: z
    .string()
    .default('http://localhost:8080,http://localhost:5173')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0),
    ),
  // Off by default: the local stack is plain-HTTP localhost. Set true behind HTTPS.
  // `z.coerce.boolean()` would treat the string "false" as truthy, so this parses explicitly.
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  SESSION_IDLE_MINUTES: z.coerce.number().int().positive().default(120),
  SESSION_ABSOLUTE_HOURS: z.coerce.number().int().positive().default(12),
  // Off in tests, CI, and OpenAPI generation so no cron keeps the process (or Jest) alive.
  REMINDERS_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  // Pre-provisioned admin account. When unset, provisioning is skipped.
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(10).max(128).optional(),
  // Loads the fictional demo dataset after migrations/admin provisioning. Off unless explicitly
  // "true" so CI and native `pnpm dev` (which leave it unset) never seed by accident.
  DEMO_DATA: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  // e2e-test-only escape hatch for RateLimitGuard, so a Playwright run with many parallel
  // sign-ins doesn't trip auth throttling. Honored only when the string is exactly "true" (the
  // same explicit-opt-in shape as the other booleans here) — must never be set in
  // docker-compose.yml or .env.example, only in docker-compose.e2e.yml.
  THROTTLE_DISABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  // Local/manual-testing-only escape hatch: skips the consultation join-window check
  // ([-15m before start, +30m after end]) so a doctor/patient can enter the workspace
  // immediately after booking instead of waiting for the window. Honored only when
  // exactly "true" (same explicit-opt-in shape as the other booleans here). Unlike
  // THROTTLE_DISABLED, this one IS wired into docker-compose.yml/.env.example (defaulted
  // to "false") since it's meant for a person manually testing the running stack, not just
  // an automated e2e run — never set it true beyond local manual testing.
  JOIN_WINDOW_DISABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  // Secret used to derive each appointment's Jitsi video-call room name (an HMAC of the
  // appointment ID), so the room can't be found by guessing/enumerating appointment IDs. No
  // default here — every environment that boots the app must set its own value (see
  // docker-compose.yml, apps/api/.env.example, and test/setup-env.ts for where it's supplied).
  JITSI_ROOM_SECRET: z.string().min(1, 'JITSI_ROOM_SECRET is required'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Runs before Nest builds the DI graph. Exits the process directly (rather than
 * throwing) so a missing/invalid setting fails fast with an unambiguous, single
 * line message instead of a stack trace from deep inside module initialization.
 */
export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    console.error(`Invalid environment configuration: ${issues}`);
    process.exit(1);
  }
  return result.data;
}
