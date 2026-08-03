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
  await page.waitForLoadState('networkidle');
  // Cold dev-server compiles can delay hydration past networkidle; retry the
  // navigation until it lands (loop exits as soon as we leave the list page).
  for (let attempt = 0; attempt < 8 && !page.url().includes('/product/new'); attempt++) {
    await page.getByRole('link', { name: /Add New/i }).click();
    await page.waitForTimeout(1500);
  }
  await expect(page).toHaveURL(/\/dashboard\/product\/new/);
  await page.waitForLoadState('networkidle');

  // The Radix category Select only opens after React hydrates; opening it is
  // our hydration signal, so we never fill a pre-hydration form (hydration
  // resets controlled inputs and blocks submit with validation errors).
  const combo = page.locator('#category');
  await combo.waitFor({ state: 'visible' });
  for (let attempt = 0; attempt < 8; attempt++) {
    await combo.click();
    const open = page.getByRole('option', { name: category, exact: true });
    try {
      await open.waitFor({ state: 'visible', timeout: 2000 });
      await open.click();
      break;
    } catch {
      // Menu did not open — React not hydrated yet; retry.
    }
  }
  await page.waitForTimeout(500);
  const selected = await combo.innerText();
  if (!selected.includes(category)) {
    await combo.click();
    const option2 = page.getByRole('option', { name: category, exact: true });
    await option2.waitFor({ state: 'visible' });
    await option2.click();
    await page.waitForTimeout(500);
  }

  await page.locator('#name').fill(name);
  await page.locator('#price').fill(price);
  await page.locator('#description').fill(description);
  await page.waitForTimeout(1000); // let form validations settle

  for (let attempt = 0; attempt < 8 && page.url().includes('/product/new'); attempt++) {
    await page.getByRole('button', { name: /Add Product/i }).click();
    await page.waitForTimeout(1500);
  }
  // Returns to the listing page (with pagination query params).
  await expect(page).toHaveURL(/\/dashboard\/product(\?.*)?$/);
}

// Types into the name column's text filter (debounced server-side search).
export async function searchProducts(page: Page, term: string): Promise<void> {
  await page.getByPlaceholder('Search products...').fill(term);
}

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
