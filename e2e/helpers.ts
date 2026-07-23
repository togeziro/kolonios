import { expect, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

export interface ProductInput {
  name: string;
  category?: string;
  price?: string;
  description?: string;
}

const SAMPLE_IMAGE = resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures/sample.png');

// Walks the "Add New Product" form end to end and submits it. Leaves the
// browser on the product listing page with a toast confirming creation.
//
// The category field is a Radix <Select>. Headless Chromium is flaky about
// opening it before the form has hydrated, so we wait for the control to be
// visible, give the form a moment to hydrate, click to open the menu, then
// click the visible [role="option"] (NOT the hidden native <option> Radix
// renders for accessibility).
export async function createProduct(page: Page, input: ProductInput): Promise<void> {
  const {
    name,
    category = 'Electronics',
    price = '19.99',
    description = 'Automated end-to-end test product description.'
  } = input;

  await page.goto('/dashboard/product');
  await page.getByRole('link', { name: /Add New/i }).click();
  await expect(page).toHaveURL(/\/dashboard\/product\/new/);

  // Upload image: react-dropzone renders a hidden <input type="file">.
  // Wait for the form to hydrate so react-dropzone's change handler is
  // attached, then upload and confirm the file card appears.
  const fileInput = page.locator('input[type="file"]');
  await fileInput.waitFor({ state: 'attached' });
  await page.waitForTimeout(1000);
  await fileInput.setInputFiles(SAMPLE_IMAGE);
  await expect(page.getByText('sample.png')).toBeVisible();

  await page.locator('#name').fill(name);

  const combo = page.locator('#category');
  await combo.waitFor({ state: 'visible' });
  await page.waitForTimeout(1000); // let the form hydrate
  await combo.click();
  const option = page.getByRole('option', { name: category, exact: true });
  await option.waitFor({ state: 'visible' });
  await option.click();

  await page.locator('#price').fill(price);
  await page.locator('#description').fill(description);
  await page.waitForTimeout(1000); // let form validations settle

  await page.getByRole('button', { name: /Add Product/i }).click();
  // Returns to the listing page (with pagination query params).
  await expect(page).toHaveURL(/\/dashboard\/product(\?.*)?$/);
}

// Types into the name column's text filter (debounced server-side search).
export async function searchProducts(page: Page, term: string): Promise<void> {
  await page.getByPlaceholder('Search products...').fill(term);
}
