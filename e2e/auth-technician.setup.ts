import { test as setup, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const AUTH_DIR = 'e2e/.auth';
mkdirSync(AUTH_DIR, { recursive: true });

async function loginAsTechnician(page: import('@playwright/test').Page) {
  await page.goto('/auth/v2/sign-in');
  await page.waitForLoadState('networkidle');
  const submit = page.getByRole('button', { name: /Login|Masuk/i });
  await submit.waitFor({ state: 'visible' });

  for (let attempt = 0; attempt < 3; attempt++) {
    await page.waitForTimeout(1000 + attempt * 1000);
    await page.locator('input[name="email"]').fill('technician@example.com');
    await page.locator('input[name="password"]').fill('Password123!');
    await submit.click();
    try {
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
      return;
    } catch {
      // Native form submit fired before React hydrated; retry.
    }
  }
  throw new Error('technician login did not reach /dashboard');
}

setup('authenticate technician', async ({ page }) => {
  await loginAsTechnician(page);
  await page.context().storageState({ path: `${AUTH_DIR}/technician.json` });
});
