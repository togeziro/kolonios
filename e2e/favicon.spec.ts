import { expect, test } from '@playwright/test';

// Regression for the favicon-not-changing bug: the root layout was placing
// { tag: 'link', rel: 'icon', ... } inside `meta[]`, but TanStack Router's
// headContentUtils forces `tag: 'meta'` for every meta entry, so browsers
// saw `<meta tag="link" ...>` and ignored it — the favicon link was never
// in the DOM and uploads never reached the browser tab.
test.describe('Favicon link rendering', () => {
  test('login page exposes a <link rel="icon"> pointing at the branding endpoint', async ({
    page
  }) => {
    await page.goto('/auth/v2/sign-in');

    const href = await page.evaluate(() => {
      const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      return link?.getAttribute('href') ?? null;
    });

    expect(href).not.toBeNull();
    expect(href).toMatch(/^\/api\/v1\/branding\/favicon/);
  });

  test('root route serves a cache-busting query string based on branding updatedAt', async ({
    page
  }) => {
    await page.goto('/');

    const href = await page.evaluate(() => {
      const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      return link?.getAttribute('href') ?? null;
    });

    expect(href).toMatch(/\?v=/);
  });
});
