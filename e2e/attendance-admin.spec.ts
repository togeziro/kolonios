import { expect, test } from '@playwright/test';

test.describe('admin attendance management', () => {
  test('admin can create a work location with geofence settings', async ({ page }) => {
    await page.goto('/dashboard/admin/attendance/locations');
    // Wait for the client bundle + React hydration before interacting; the
    // controlled form inputs reset to their state value on hydration.
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Attendance Locations').first()).toBeVisible({ timeout: 10_000 });

    const name = `E2E Office ${Date.now()}`;
    await page.locator('#loc-name').fill(name);
    await page.locator('#loc-radius').fill('120');
    await page.waitForTimeout(500); // let the form settle after hydration
    await page.getByRole('button', { name: /Save Location/i }).click();

    await expect(page.getByText(name)).toBeVisible({ timeout: 10_000 });
  });

  test('admin can create a schedule with weekday rules', async ({ page }) => {
    await page.goto('/dashboard/admin/attendance/schedules');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Attendance Schedules').first()).toBeVisible({ timeout: 10_000 });

    const name = `E2E Shift ${Date.now()}`;
    await page.locator('#sch-name').fill(name);
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: /Save Schedule/i }).click();

    await expect(page.getByText('Schedule saved')).toBeVisible({ timeout: 10_000 });
  });

  test('admin can open the attendance report page', async ({ page }) => {
    await page.goto('/dashboard/admin/attendance/reports');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Attendance Reports').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /Export CSV/i })).toBeVisible();
  });
});
