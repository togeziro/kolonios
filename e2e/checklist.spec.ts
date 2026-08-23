import { expect, test } from '@playwright/test';

test.use({ storageState: 'e2e/.auth/technician.json' });

test.describe('daily checklist', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/daily-checklist', { waitUntil: 'networkidle' });
  });

  test('loads daily checklist page for authenticated user', async ({ page }) => {
    await expect(page.locator('main').first()).toBeVisible({ timeout: 10_000 });
  });

  test('shows day-off or checklist depending on day type', async ({ page }) => {
    const hasDayOff = await page.getByText(/day off|weekend|non-working/i).isVisible();
    const hasChecklist = await page.getByText('Daily Checklist').isVisible();

    expect(
      hasDayOff || hasChecklist,
      'Should show either day-off message or checklist'
    ).toBeTruthy();
  });
});
