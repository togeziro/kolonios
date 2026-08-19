// Worktree-local Playwright override: targets the worktree dev server on :3001
// so e2e runs against the current branch's code, not the main checkout on :3000.
// Invoke with: PLAYWRIGHT_CONFIG=playwright.worktree.config.ts bunx playwright test
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    launchOptions: {
      args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream']
    }
  },
  projects: [
    { name: 'setup', testMatch: /.*auth.*\.setup\.ts/ },
    {
      name: 'technician',
      testMatch: /en-route\.spec\.ts/,
      use: {
        baseURL: 'http://localhost:3001',
        storageState: 'e2e/.auth/technician.json',
        permissions: ['geolocation'],
        geolocation: { latitude: -6.2088, longitude: 106.8456, accuracy: 20 }
      },
      dependencies: ['setup']
    }
  ],
  webServer: {
    command: 'bun run dev',
    url: 'http://localhost:3001',
    reuseExistingServer: true,
    timeout: 120_000
  }
});
