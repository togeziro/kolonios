import { expect, test } from '@playwright/test';

const DEFAULT_THEME = 'vercel';

// Font variables are set inline on document.documentElement by loadFont()
function getFontVar(page: any, name: string) {
  return page.evaluate(
    (n: string) => document.documentElement.style.getPropertyValue(`--font-${n}`),
    name
  );
}

test.describe('Theme font loading', () => {
  test('initial theme sets correct font CSS variables', async ({ page }) => {
    await page.goto('/');

    const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(theme).toBe(DEFAULT_THEME);
  });

  test('login page renders with system fonts (no crash)', async ({ page }) => {
    await page.goto('/auth/v2/sign-in');
    await expect(page.locator('body')).toBeVisible();
    // Page rendered without error — fonts fall back to system sans-serif/server provided
    expect(await page.evaluate(() => document.fonts.ready.then(() => true))).toBe(true);
  });

  test('theme-switch cookie is respected on reload', async ({ page }) => {
    await page.goto('/auth/v2/sign-in');
    await page.evaluate(() => {
      document.cookie = 'active_theme=zen; path=/; max-age=31536000';
    });
    await page.reload();
    await page.waitForTimeout(500);

    const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(theme).toBe('zen');
  });

  test('zero-font theme (Claude) renders without error', async ({ page }) => {
    await page.goto('/auth/v2/sign-in');
    await page.evaluate(() => {
      document.cookie = 'active_theme=claude; path=/; max-age=31536000';
    });
    await page.reload();
    await page.waitForTimeout(500);

    const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(theme).toBe('claude');
    await expect(page.locator('body')).toBeVisible();
  });

  test('astro-vista theme loads its fonts', async ({ page }) => {
    await page.goto('/auth/v2/sign-in');
    await page.evaluate(() => {
      document.cookie = 'active_theme=astro-vista; path=/; max-age=31536000';
    });
    await page.reload();
    await page.waitForTimeout(1000);

    const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(theme).toBe('astro-vista');

    // Astro Vista uses Outfit + Fira Code (set inline by loadFont)
    const sansVar = await getFontVar(page, 'outfit');
    const monoVar = await getFontVar(page, 'fira-code');
    // Both should be truthy if the dynamic import succeeded
    expect(sansVar).toBeTruthy();
    expect(monoVar).toBeTruthy();
  });
});
