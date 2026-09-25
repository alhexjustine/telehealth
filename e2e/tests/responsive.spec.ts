import { expect, test } from '@playwright/test';

const NARROW_WIDTH = 360;
const NARROW_HEIGHT = 800;

const PUBLIC_PATHS = ['/', '/terms', '/privacy', '/login', '/register/patient', '/register/doctor'];

/**
 * The `journey-verification` spec's "Narrow viewport": at a 360px-wide
 * viewport, the public pages must not scroll horizontally. Carries over a
 * manual check from `add-product-website` that headless Chrome previously
 * couldn't emulate.
 */
test('Narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: NARROW_WIDTH, height: NARROW_HEIGHT });

  for (const path of PUBLIC_PATHS) {
    await test.step(`No horizontal scroll at ${path}`, async () => {
      await page.goto(path, { waitUntil: 'load' });
      await expect(page.locator('body')).toBeVisible();

      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));

      expect
        .soft(
          overflow.scrollWidth,
          `${path} overflows at 360px: scrollWidth=${overflow.scrollWidth} > innerWidth=${overflow.innerWidth}`,
        )
        .toBeLessThanOrEqual(overflow.innerWidth);
    });
  }
});
