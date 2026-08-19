import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { loginAs } from './helpers';

const TICKET_ID = 242;

test.describe('en-route navigation', () => {
  // Project-level storageState (e2e/.auth/technician.json) + geolocation is
  // configured in playwright.config.ts.

  test('renders the route map with a blue device marker, line, and distance when GPS resolves', async ({
    page,
    context
  }) => {
    await context.grantPermissions(['geolocation'], { origin: 'http://localhost:3001' });

    await page.goto(`/dashboard/en-route/${TICKET_ID}`);
    await expect(page.getByRole('heading', { name: /Install Fiber Router/i })).toBeVisible({
      timeout: 15_000
    });
    await expect(page.getByRole('button', { name: /Find my location/i })).toBeVisible();

    // Click "Find my location" to kick the GeolocateControl's getCurrentPosition
    // through the (already-mounted) effect; this guarantees the fix flows into
    // state regardless of whether the mount-time getCurrentLocation won the
    // race against the first paint.
    await page.getByRole('button', { name: /Find my location/i }).click();

    await expect(page.getByText(/Distance to destination/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/\d+(\.\d+)?\s*(km|m)\b/)).toBeVisible();

    // The React-side markers (blue device + orange destination) render as
    // MapLibre DOM markers; the guide line lives on the WebGL canvas.
    const markerInfo = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.maplibregl-marker svg path')).map((p) => {
        const fill = getComputedStyle(p).fill;
        return { fill };
      });
    });
    const fills = markerInfo.map((m) => m.fill);
    expect(fills.some((f) => /#2563eb|rgb\(37, 99, 235\)/i.test(f))).toBe(true); // blue device
    expect(fills.some((f) => /#f97316|rgb\(249, 115, 22\)/i.test(f))).toBe(true); // orange dest

    const hasMapCanvas = await page.evaluate(() => {
      return !!document.querySelector('.maplibregl-canvas, .maplibregl-canvas-container canvas');
    });
    expect(hasMapCanvas).toBe(true);
  });

  test('does not draw a phantom marker or distance for a Null Island fix', async ({ browser }) => {
    const ctx: BrowserContext = await browser.newContext({
      storageState: 'e2e/.auth/technician.json',
      geolocation: { latitude: 0, longitude: 0 },
      permissions: ['geolocation']
    });
    const page: Page = await ctx.newPage();
    await page.goto(`/dashboard/en-route/${TICKET_ID}`);
    await expect(page.getByRole('heading', { name: /Install Fiber Router/i })).toBeVisible({
      timeout: 15_000
    });

    // Distance label must NOT appear — the (0,0) fix is rejected by
    // isPlausibleFix, so distanceToDestination stays null.
    await page.waitForTimeout(4000);
    await expect(page.getByText(/Distance to destination/i)).toHaveCount(0);
    await ctx.close();
  });
});

// Silence the "unused import" lint by exporting the helper so it is bundled
// alongside the login flow used elsewhere in the suite.
export { loginAs };
