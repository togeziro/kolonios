import { expect, test, type Page } from '@playwright/test';
import { and, eq } from 'drizzle-orm';
import { db } from '../src/lib/db';
import { user } from '../src/lib/db/auth-schema';
import { employeeShifts } from '../src/lib/db/schema/attendance';

test.use({ storageState: 'e2e/.auth/employee.json' });

// The e2e suite shares the dev database, so attendance state can leak between
// runs and between tests. Reset the demo employee's attendance for the current
// business day (WIB) before every test so each one starts from a clean state.
test.beforeEach(async () => {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());

  const [emp] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, 'employee@example.com'))
    .limit(1);
  if (emp) {
    await db
      .delete(employeeShifts)
      .where(and(eq(employeeShifts.user_id, emp.id), eq(employeeShifts.date, today)));
  }
});

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
    // validation and is rejected for missing location data. The server sends
    // the GPS_REQUIRED error code, which the card maps to the localized toast
    // (English in the default Playwright browser locale).
    await expect(page.getByText(/GPS location is required/i)).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('check-out selfie policy', () => {
  // Position the employee inside the Head Office geofence with a fake GPS and
  // capture a selfie so the card reaches the check-out flow.
  async function checkInFromHeadOffice(page: Page) {
    await page.context().grantPermissions(['geolocation'], {
      origin: 'http://localhost:3000'
    });
    await page.context().setGeolocation({ latitude: -6.2088, longitude: 106.8456, accuracy: 5 });

    await page.goto('/dashboard/attendance');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /Head Office/i }).click();
    await page.getByRole('button', { name: /Get Location/i }).click();
    await page.getByRole('button', { name: /Capture Selfie/i }).click();
    await page.getByRole('button', { name: /Capture/i }).click();
    await page.getByRole('button', { name: /Check In/i }).click();
    await expect(page.getByRole('button', { name: /Check Out/i })).toBeVisible({
      timeout: 15_000
    });
  }

  test('check-out without a selfie is rejected when the location requires one', async ({
    page
  }) => {
    await checkInFromHeadOffice(page);

    await page.getByRole('button', { name: /Check Out/i }).click();
    await expect(page.getByText(/selfie photo is required/i)).toBeVisible({ timeout: 15_000 });
  });

  test('check-out with a selfie succeeds and leaves the checked-out state', async ({ page }) => {
    await checkInFromHeadOffice(page);

    await page.getByRole('button', { name: /Capture Selfie/i }).click();
    await page.getByRole('button', { name: /Capture/i }).click();
    await page.getByRole('button', { name: /Check Out/i }).click();

    // After a successful check-out the card no longer offers the check-out
    // action; it shows the checked-out time instead.
    await expect(page.getByText(/Check-out:/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /Check Out/i })).toHaveCount(0);
  });
});
