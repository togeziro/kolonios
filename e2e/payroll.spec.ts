import { expect, test } from '@playwright/test';
import { eq } from 'drizzle-orm';
import { db } from '../src/lib/db';
import { auditLog } from '../src/lib/db/schema/audit-log';
import { payrollPeriods } from '../src/lib/db/schema/payroll';

const periodName = 'Task 7 Demo Payroll';

test.describe('payroll administration and employee payslip access', () => {
  test('admin completes payroll and employee downloads only their payslip', async ({
    page,
    browser
  }) => {
    await page.goto('/dashboard/admin/payroll/periods');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(periodName)).toBeVisible({ timeout: 10_000 });

    await page.goto('/dashboard/admin/payroll/generate');
    await page.waitForLoadState('networkidle');
    await page
      .locator('#payroll-period')
      .selectOption({ label: `${periodName} (2026-08-01 - 2026-08-31)` });
    await page.getByRole('button', { name: /Generate/i }).click();

    await page.goto('/dashboard/admin/payroll/records');
    await page.waitForLoadState('networkidle');
    await page.locator('#record-period').selectOption({ label: periodName });
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 15_000 });
    await page
      .getByRole('button', { name: /^Adjust$/i })
      .first()
      .click();
    await page.getByLabel(/Adjustment name/i).fill('Task 7 bonus');
    await page.getByLabel(/Amount/i).fill('100');
    await page.getByRole('button', { name: /Add adjustment/i }).click();
    await page.getByRole('button', { name: /Save adjustments/i }).click();
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.locator('#record-period').selectOption({ label: periodName });

    await page
      .getByRole('button', { name: /Approve/i })
      .first()
      .click();
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.locator('#record-period').selectOption({ label: periodName });
    await page
      .getByRole('button', { name: /Mark as Paid/i })
      .first()
      .click();
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.locator('#record-period').selectOption({ label: periodName });
    await page.getByRole('button', { name: /Lock/i }).first().click();

    const employeeContext = await browser.newContext({ storageState: 'e2e/.auth/employee.json' });
    const employeePage = await employeeContext.newPage();
    await employeePage.goto('/dashboard/payroll/payslips');
    await employeePage.waitForLoadState('networkidle');
    await expect(employeePage.getByRole('cell', { name: periodName })).toBeVisible({
      timeout: 15_000
    });
    await expect(employeePage.getByText('Demo Employee')).toBeVisible();
    await expect(employeePage.getByText('Demo Admin')).toHaveCount(0);
    const download = employeePage.waitForEvent('download');
    await employeePage
      .getByRole('button', { name: /Download/i })
      .first()
      .click();
    await expect((await download).suggestedFilename()).toMatch(/\.pdf$/);
    await employeeContext.close();

    const [period] = await db
      .select({ id: payrollPeriods.id })
      .from(payrollPeriods)
      .where(eq(payrollPeriods.name, periodName))
      .limit(1);
    if (!period) throw new Error(`Missing payroll period ${periodName}`);
    const auditRows = await db
      .select({ action: auditLog.action, after: auditLog.after })
      .from(auditLog);
    expect(auditRows.map((row) => row.action)).toEqual(
      expect.arrayContaining([
        'payroll.generate',
        'payroll.record.adjust',
        'payroll.approve',
        'payroll.pay',
        'payroll.lock'
      ])
    );
    expect(
      JSON.stringify(auditRows).match(/000000000001|TAX-DEMO-001|account_number|tax_identifier/)
    ).toBeNull();
  });
});
