import { expect, test } from '@playwright/test';

const RETRY_MS = 300;
const MAX_WAIT_MS = 20_000;

test('sorting by name updates the URL sort param', async ({ page }) => {
  await page.goto('/dashboard/product');

  const nameBtn = page.getByRole('button', { name: /Name/i });
  await nameBtn.waitFor({ state: 'visible' });

  // The sort control is a Radix dropdown menu whose items are
  // menuitemcheckbox (not menuitem). Headless Chromium is occasionally flaky
  // about opening it on the first click, so retry until the "Desc" item shows.
  const maxAttempts = Math.ceil(MAX_WAIT_MS / RETRY_MS);
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await nameBtn.click({ force: true });
    await page.waitForTimeout(RETRY_MS);
    const desc = page.getByRole('menuitemcheckbox', { name: /Desc/i });
    if (await desc.isVisible()) {
      await desc.click();
      await expect(page).toHaveURL(/sort=/);
      return;
    }
  }
  throw new Error('Desc option never became visible while opening Name menu');
});
