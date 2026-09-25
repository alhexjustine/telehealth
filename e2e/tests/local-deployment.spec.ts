import { test, expect } from '@playwright/test';

/**
 * Cross-cutting proof that nginx's same-origin routing actually works
 * end to end against the real containerized stack (`local-deployment`
 * spec's "Same-origin routing through the web entrypoint") — every other
 * spec file already relies on this working, but none of them asserts it
 * directly the way these three do.
 */
test.describe('Same-origin routing', () => {
  test('API request through the web origin', async ({ page }) => {
    // A same-origin `fetch` from inside the page (not Playwright's own
    // request context, which doesn't go through the browser's origin at
    // all) proves the browser can reach `/api/*` without a cross-origin
    // call — exactly what a real page's own API calls do.
    await page.goto('/');
    const body = await page.evaluate(async () => {
      const response = await fetch('/api/health');
      return { status: response.status, json: await response.json() };
    });
    expect(body.status).toBe(200);
    expect(body.json.status).toBe('ok');
  });

  test('Deep link to a client-side route', async ({ page }) => {
    // A path with no server-side route of its own: nginx must serve the SPA
    // shell (which then renders the client-side "not found" page) instead of
    // its own 404, or a raw network/HTTP error.
    const response = await page.goto('/some/deep/link');
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { name: /page not found/i })).toBeVisible();
  });

  test('WebSocket upgrade path', async ({ page }) => {
    // Opens a real WebSocket from inside the page to `/socket.io/` on the
    // web origin (port 8080) — if nginx didn't forward the upgrade request
    // to the API, this would never reach `open` (it would error or hang).
    // Engine.IO's handshake doesn't require an authenticated session just to
    // complete the transport-level upgrade; that's enforced afterward by the
    // gateway's own `authenticate()` (see CLAUDE.md's realtime gotchas),
    // which is out of scope for this same-origin-routing check.
    await page.goto('/');
    const outcome = await page.evaluate(
      () =>
        new Promise<string>((resolve) => {
          const url = `${window.location.origin.replace('http', 'ws')}/socket.io/?EIO=4&transport=websocket`;
          const socket = new WebSocket(url);
          const timer = setTimeout(() => {
            socket.close();
            resolve('timeout');
          }, 8_000);
          socket.onopen = () => {
            clearTimeout(timer);
            socket.close();
            resolve('open');
          };
          socket.onerror = () => {
            clearTimeout(timer);
            resolve('error');
          };
        }),
    );
    expect(outcome).toBe('open');
  });
});
