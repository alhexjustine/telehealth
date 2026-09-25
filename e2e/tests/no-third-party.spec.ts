import { expect, test } from '@playwright/test';
import { trackForeignRequests } from '../fixtures/no-third-party.js';

const PUBLIC_PATHS = ['/', '/login', '/register/patient', '/register/doctor'];

/**
 * The `journey-verification` spec's "Cross-cutting browser checks" (also
 * carrying the `product-website` capability's "No third-party requests at
 * runtime" scenario, per the coordinator's instruction): the landing,
 * sign-in, and both registration pages must make no requests to any origin
 * other than the application's own.
 */
test('No third-party requests at runtime', async ({ page, baseURL }) => {
  const appOrigin = new URL(baseURL ?? 'http://localhost:8080').origin;

  for (const path of PUBLIC_PATHS) {
    await test.step(`No third-party requests on ${path}`, async () => {
      const foreign = trackForeignRequests(page, appOrigin);
      await page.goto(path, { waitUntil: 'load' });
      // Bounded settle (not `networkidle`, which the app's live socket.io
      // connection would keep pending forever once signed in — these pages
      // are all signed-out, but the helper stays consistent with the rest of
      // the suite): gives any chained, post-load fetch a fixed window to fire.
      await page.waitForTimeout(1_000);
      expect(foreign, `Requests to another origin from ${path}: ${foreign.join(', ')}`).toEqual([]);
    });
  }
});

/**
 * Proves the check logic itself works (design.md: "assert the check logic
 * flags an injected cross-origin request in a fixture page"), independent of
 * whether the app happens to be clean right now.
 */
test('Third-party request detected', async ({ page, baseURL }) => {
  const appOrigin = new URL(baseURL ?? 'http://localhost:8080').origin;
  const foreign = trackForeignRequests(page, appOrigin);

  await page.setContent('<html><body><img src="https://example.invalid/tracker.png" /></body></html>');
  await page.waitForTimeout(1_000);

  const trackerRequest = foreign.find((url) => url.includes('example.invalid/tracker.png'));
  expect(trackerRequest, `Expected the tracking helper to flag https://example.invalid/tracker.png, saw: ${foreign.join(', ')}`).toBeTruthy();
});
