import { test as setup, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const AUTH_DIR = 'e2e/.auth';
mkdirSync(AUTH_DIR, { recursive: true });

async function loginAndSave(page: import('@playwright/test').Page, file: string) {
  await page.goto('/auth/v2/sign-in');
  await page.waitForLoadState('networkidle');
  const submit = page.getByRole('button', { name: /Login|Masuk/i });
  await submit.waitFor({ state: 'visible' });

  const email = file.includes('admin') ? 'admin@example.com' : 'employee@example.com';
  const password = 'Password123!';

  for (let attempt = 0; attempt < 3; attempt++) {
    await page.waitForTimeout(1000 + attempt * 1000); // let the form hydrate
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill(password);
    await submit.click();
    try {
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
      break;
    } catch {
      // Native form submit fired before React hydrated (URL echoes the fields).
      // The app is now hydrated; retry the login.
    }
  }
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  await page.context().storageState({ path: file });
}

setup('authenticate admin', async ({ page }) => {
  await loginAndSave(page, `${AUTH_DIR}/admin.json`);
});

setup('authenticate employee', async ({ page }) => {
  await loginAndSave(page, `${AUTH_DIR}/employee.json`);
});
