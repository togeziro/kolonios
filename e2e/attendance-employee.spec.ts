import { expect, test } from '@playwright/test';

test.use({ storageState: 'e2e/.auth/employee.json' });

test.describe('employee attendance', () => {
  test('employee sees the attendance check card with location controls', async ({ page }) => {
    await page.goto('/dashboard/attendance');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('button', { name: /Check In/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /Get Location/i })).toBeVisible();
  });

  test('employee gets GPS guidance when location permission is missing', async ({ page }) => {
    // No geolocation permission granted: the flow must surface a guidance
    // message instead of crashing.
    await page.goto('/dashboard/attendance');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /Get Location/i }).click();

    await expect(
      page.getByText(/could not get your location|tidak dapat mengambil lokasi/i)
    ).toBeVisible({ timeout: 10_000 });
  });

  test('employee check-in without GPS location is rejected with guidance', async ({ page }) => {
    await page.goto('/dashboard/attendance');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /Check In/i }).click();

    // The seeded employee has an active schedule, so check-in reaches GPS
    // validation and is rejected for missing location data.
    await expect(page.getByText(/GPS location is required/i)).toBeVisible({ timeout: 10_000 });
  });
});
