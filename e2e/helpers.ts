import { expect, type Page } from '@playwright/test';

export async function loginAs(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/auth/v2/sign-in');
  const submit = page.getByRole('button', { name: /Login|Masuk/i });
  await submit.waitFor({ state: 'visible' });
  await page.waitForTimeout(1000); // let the form hydrate before interacting
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await submit.click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
}
