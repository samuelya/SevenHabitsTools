import { defineConfig } from '@playwright/test';

/**
 * Playwright harness for the app's Definition of Done (architecture issue #1 §9): a smoke pass
 * per feature at 360x800 (mobile) and 1280x800 (desktop), in `en` and `ar`. Feature PRs add a
 * spec file under `e2e/`; they should not need to touch this config.
 *
 * Chromium only, to keep CI fast — see `docs/testing.md` for the reasoning and how to add other
 * browser engines later.
 */
const PORT = 4300;
const BASE_URL = process.env['PLAYWRIGHT_BASE_URL'] ?? `http://localhost:${PORT}`;
const BUILD_OUTPUT = 'dist/web/browser';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI']
    ? [['html', { outputFolder: 'playwright-report', open: 'never' }], ['list']]
    : [['html', { outputFolder: 'playwright-report', open: 'on-failure' }], ['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'mobile-en',
      use: {
        browserName: 'chromium',
        viewport: { width: 360, height: 800 },
        hasTouch: true,
        isMobile: true,
        locale: 'en-US',
      },
    },
    {
      name: 'mobile-ar',
      use: {
        browserName: 'chromium',
        viewport: { width: 360, height: 800 },
        hasTouch: true,
        isMobile: true,
        locale: 'ar-SA',
      },
    },
    {
      name: 'desktop-en',
      use: {
        browserName: 'chromium',
        viewport: { width: 1280, height: 800 },
        locale: 'en-US',
      },
    },
    {
      name: 'desktop-ar',
      use: {
        browserName: 'chromium',
        viewport: { width: 1280, height: 800 },
        locale: 'ar-SA',
      },
    },
  ],
  // Skipped when PLAYWRIGHT_BASE_URL points at an already-running server (see docs/testing.md).
  webServer: process.env['PLAYWRIGHT_BASE_URL']
    ? undefined
    : {
        command: `node e2e/static-server.mjs ${BUILD_OUTPUT} ${PORT}`,
        url: BASE_URL,
        reuseExistingServer: !process.env['CI'],
        timeout: 30_000,
      },
});
