import { expect, test } from '@playwright/test';
import { eq } from 'drizzle-orm';
import { db } from '../src/lib/db';
import { employees } from '../src/lib/db/schema/employees';
import { designations } from '../src/lib/db/schema/masterdata';
import { employeeCareerEvents } from '../src/lib/db/schema/employee-career-events';

// Ticket 04 happy path: HR records a Change Position event from the Career
// Timeline sub-tab. The HR storageState comes from e2e/auth.setup.ts
// (hr@example.com holds the HR role group with employees.edit).
test.use({ storageState: 'e2e/.auth/hr.json' });

test.describe('career timeline append', () => {
  test('HR appends a Change Position event; timeline updates and employees.designation_id follows', async ({
    page
  }) => {
    // 1. Open the employees list and drill into the first employee.
    await page.goto('/dashboard/employees');
    await page.waitForLoadState('networkidle');
    const nameLink = page.locator('tbody tr').first().locator('a[href*="/dashboard/employees/"]');
    await expect(nameLink).toBeVisible({ timeout: 15_000 });
    await nameLink.click();
    await expect(page).toHaveURL(/\/dashboard\/employees\/.+/, { timeout: 15_000 });
    const employeeId = page.url().split('/dashboard/employees/')[1]?.split(/[?#]/)[0];
    if (!employeeId) throw new Error('could not parse employee id from URL');

    // 2. Resolve the employee's current designation and pick a different one.
    const [current] = await db
      .select({ designation_id: employees.designation_id })
      .from(employees)
      .where(eq(employees.id, employeeId))
      .limit(1);
    if (!current) throw new Error(`employee ${employeeId} missing from DB`);
    const others = await db
      .select({ id: designations.id, name: designations.name })
      .from(designations);
    const target = others.find((d) => d.id !== current.designation_id);
    if (!target) throw new Error('need at least two designations in masterdata');
    const eventsBefore = await db
      .select({ id: employeeCareerEvents.id })
      .from(employeeCareerEvents)
      .where(eq(employeeCareerEvents.employee_id, employeeId));

    // 3. Open the Career Timeline sub-tab.
    await page.waitForLoadState('networkidle');
    await page.getByRole('tab', { name: /Career Timeline|Linimasa Karier/i }).click();
    const changePosition = page.getByTestId('career-action-position');
    await expect(changePosition).toBeVisible({ timeout: 10_000 });

    // 4. Fill the modal (designation + effective_date default + notes).
    await changePosition.click();
    const dialog = page.getByTestId('career-event-dialog-position');
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    const picker = page.getByTestId('career-event-to-designation');
    await expect
      .poll(async () => picker.locator(`option[value="${target.id}"]`).count(), { timeout: 10_000 })
      .toBe(1);
    await picker.selectOption(String(target.id));
    // Effective date defaults to today — leave it untouched.
    await page.getByTestId('career-event-notes').fill('Promoted after Q2 review (e2e)');
    await page.getByTestId('career-event-submit').click();

    // 5. The dialog closes and the new event appears at the top of the timeline.
    await expect(dialog).toBeHidden({ timeout: 15_000 });
    const firstItem = page.locator('[data-testid="career-event-item"]').first();
    await expect(firstItem).toContainText(target.name, { timeout: 15_000 });

    // 6. The dual-write landed: employees.designation_id follows, and exactly
    //    one new event row exists for this employee.
    await expect
      .poll(async () => {
        const [row] = await db
          .select({ designation_id: employees.designation_id })
          .from(employees)
          .where(eq(employees.id, employeeId))
          .limit(1);
        return row?.designation_id;
      })
      .toBe(target.id);
    const eventsAfter = await db
      .select({ id: employeeCareerEvents.id })
      .from(employeeCareerEvents)
      .where(eq(employeeCareerEvents.employee_id, employeeId));
    expect(eventsAfter.length).toBe(eventsBefore.length + 1);
  });
});
