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

  test('report rows are painted when present (zero-height table guard)', async ({ page }) => {
    // Regression guard: the shared DataTable renders into an
    // `absolute inset-0` scrollport that collapses to zero height when the
    // page breaks the viewport-filling flex chain. Rows then exist in the
    // AX tree but are clipped and unclickable — `toBeVisible` alone cannot
    // catch it, so hit-test the first row's center point instead.
    await page.goto('/dashboard/admin/attendance/reports');
    await page.waitForLoadState('networkidle');
    const rows = page.locator('table tbody tr');
    if ((await rows.count()) === 0) test.skip(true, 'no attendance rows in shared DB');
    await rows.first().scrollIntoViewIfNeeded();
    const hit = await rows.first().evaluate((row) => {
      const r = row.getBoundingClientRect();
      const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !!el && (el === row || row.contains(el));
    });
    expect(hit).toBe(true);
  });
});
