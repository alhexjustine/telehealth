import { defineConfig, devices } from '@playwright/test';

/**
 * Runs against the containerized stack (nginx-served web + the API behind
 * it), not `pnpm dev` — see design.md's "Browser test package" rejected
 * alternative: `pnpm dev` doesn't exercise nginx, its CSP, or the container
 * entrypoints, which are exactly the integration risks this suite covers.
 * Bring the stack up first with:
 *   docker compose -f docker-compose.yml -f docker-compose.e2e.yml up --build -d
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:8080';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['html', { open: 'never' }], ['list']],

  // A sane bounded default — individual tests (e.g. the full core journey,
  // spanning three roles) opt into a longer explicit timeout with
  // `test.setTimeout(...)`. Never rely on open-ended waits like
  // `page.waitForLoadState('networkidle')`: once signed in, the app holds a
  // live socket.io connection, which keeps the network "busy" forever.
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },

  use: {
    baseURL,
    actionTimeout: 15_000,
    navigationTimeout: 20_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Pinned so `prefers-color-scheme` — and therefore which of
    // `apps/web/src/index.css`'s two token sets renders — doesn't depend on
    // the host machine's OS-level appearance setting. Without this, the same
    // suite (in particular `a11y.spec.ts`) can pass or fail non-deterministically
    // depending on whether the machine running it is in dark mode.
    colorScheme: 'light',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
