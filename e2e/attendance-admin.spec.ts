import { expect, test } from '@playwright/test';
import { and, eq } from 'drizzle-orm';
import { db } from '../src/lib/db';
import { user } from '../src/lib/db/auth-schema';
import { employeeShifts } from '../src/lib/db/schema/attendance';

// The dev e2e suite shares one database, so a successful manual-entry run
// leaves Demo HR's same-day row behind. The next run would then hit the
// overwrite-confirm AlertDialog that this test does not (yet) cover. Reset
// before each test so the happy-path assertion stays stable across re-runs.
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
    .where(eq(user.email, 'hr@example.com'))
    .limit(1);
  if (emp) {
    await db
      .delete(employeeShifts)
      .where(and(eq(employeeShifts.user_id, emp.id), eq(employeeShifts.date, today)));
  }
});

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

  // Manual entry dialog (commit 42fc107): admin records a clock-in/out for an
  // employee without a pre-existing shift on that date. Demo HR is the only
  // seeded demo employee without any attendance rows, so this dialog never
  // has to handle the overwrite-confirm branch here (covered separately).
  // The beforeEach hook at the top of this file resets Demo HR's same-day
  // row between runs.
  test('admin can record a manual attendance entry via the Add Attendance dialog', async ({
    page
  }) => {
    // The dialog defaults `date` to `businessDateInTimeZone(new Date())`
    // (Asia/Jakarta). Match that here so the row assertion is stable around
    // the day boundary in business time.
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());

    // Resolve Demo HR's user id from the seed so the test does not depend
    // on the visible option label (which is just `full_name`).
    const [hrUser] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, 'hr@example.com'))
      .limit(1);
    test.skip(!hrUser, 'Demo HR user missing from seed');

    await page.goto('/dashboard/admin/attendance/reports');
    await page.waitForLoadState('networkidle');

    // Open the dialog from the toolbar button.
    await expect(page.getByRole('button', { name: /Add Attendance/i })).toBeVisible({
      timeout: 10_000
    });
    await page.getByRole('button', { name: /Add Attendance/i }).click();

    // Dialog renders the form. data-testid hooks live in
    // admin-attendance-add-dialog.tsx for employee + check-in/out + reason
    // + save.
    await expect(page.getByTestId('manual-attendance-employee')).toBeVisible({ timeout: 10_000 });

    await page.getByTestId('manual-attendance-employee').selectOption({ value: hrUser!.id });

    // Native <input type="time"> controls — fill() drives the change event
    // and stays in sync with the form state.
    await page.getByTestId('manual-attendance-check-in').fill('08:00');
    await page.getByTestId('manual-attendance-check-out').fill('17:00');

    await page.getByTestId('manual-attendance-reason').fill('e2e: forgot to clock in');

    await page.getByTestId('manual-attendance-save').click();

    // Dialog closes and the table refreshes via queryClient.invalidateQueries.
    await expect(page.getByTestId('manual-attendance-employee')).toBeHidden({ timeout: 15_000 });

    // The new row appears. We don't assert "top row" because the shared DB
    // already has Demo Technician's today entry — sort order between the
    // two same-date rows is implementation-defined.
    const hrRow = page.locator('table tbody tr', { hasText: 'Demo HR' });
    await expect(hrRow).toBeVisible({ timeout: 10_000 });
    await expect(hrRow).toContainText(today);
    await expect(hrRow).toContainText('08:00');
    await expect(hrRow).toContainText('17:00');
  });
});
