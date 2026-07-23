import { expect, test } from '@playwright/test';
import { createProduct, searchProducts } from './helpers';

test('user can create a product', async ({ page }) => {
  const name = `E2E Product ${Date.now()}`;
  await createProduct(page, { name });

  await searchProducts(page, name);
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
});

test('user can update a product', async ({ page }) => {
  const original = `E2E Update ${Date.now()}`;
  const updated = `E2E Updated ${Date.now()}`;
  await createProduct(page, { name: original });

  await searchProducts(page, original);
  const row = page.locator('tbody tr').filter({ hasText: original }).first();
  await row.getByRole('button', { name: /Open menu/i }).click();
  await page.getByRole('menuitem', { name: /Update/i }).click();
  await expect(page).toHaveURL(/\/dashboard\/product\/\d+/);

  await page.locator('#name').fill(updated);
  await page.getByRole('button', { name: /Update Product/i }).click();
  await expect(page).toHaveURL(/\/dashboard\/product/);

  await searchProducts(page, updated);
  await expect(page.getByText(updated, { exact: true }).first()).toBeVisible();
  await expect(page.getByText(original)).toHaveCount(0);
});

test('user can delete a product', async ({ page }) => {
  const name = `E2E Delete ${Date.now()}`;
  await createProduct(page, { name });

  await searchProducts(page, name);
  const row = page.locator('tbody tr').filter({ hasText: name }).first();
  await row.getByRole('button', { name: /Open menu/i }).click();
  await page.getByRole('menuitem', { name: /Delete/i }).click();
  await page.getByRole('button', { name: /Continue/i }).click();

  // Reload to read fresh data from the server (verifies the delete persisted).
  await page.reload();
  await expect(page.getByText(name)).toHaveCount(0);
});
