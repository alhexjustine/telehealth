import type { Page } from '@playwright/test';

/**
 * Subscribes to `page.on('request')` and returns a live array that
 * accumulates the URL of every request whose origin differs from
 * `allowedOrigin`. Register this *before* navigating (or calling
 * `page.setContent`) so no request is missed; the array keeps growing until
 * the page is closed, so read it any time after the page has settled.
 *
 * `data:`/`blob:` requests (their `origin` is the string `"null"`) are
 * excluded: they're never a fetch to another host, just an inline resource
 * the page itself generated (e.g. the CSP already allows `img-src ... data:`
 * for exactly this reason) — see the `product-website` capability's "No
 * third-party requests at runtime".
 */
export function trackForeignRequests(page: Page, allowedOrigin: string): string[] {
  const foreign: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    let origin: string;
    try {
      origin = new URL(url).origin;
    } catch {
      return;
    }
    if (origin === 'null') return; // data:/blob: — not a cross-origin network request
    if (origin !== allowedOrigin) {
      foreign.push(url);
    }
  });
  return foreign;
}
