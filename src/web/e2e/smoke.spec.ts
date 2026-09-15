import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * App-shell smoke pass, run against all four projects (`playwright.config.ts`): the happy path
 * every feature PR builds on top of, per architecture issue #1 §9. Feature PRs add their own
 * spec file under `e2e/` for their own happy path; they should not need to edit this one.
 */

const VISITED_PAGES = ['/', '/habits', '/plan', '/journal', '/settings', '/about'] as const;

/** The shell's main nav lives in two places (bottom nav on handset, side nav otherwise); only
 * one is visible at a time, so tests target the one the current project's viewport shows. */
function mainNav(page: Page, projectName: string) {
  const isMobile = projectName.startsWith('mobile-');
  return page.locator(isMobile ? 'nav.bottom-nav' : 'nav.side-nav__main');
}

test.describe('app shell smoke', () => {
  test('loads the home page', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Seven Habits Tools');
    await expect(page).toHaveTitle('Home | Seven Habits Tools');
  });

  test('applies the global stylesheet under the production CSP', async ({ page }) => {
    test.fixme(
      true,
      "Needs #118 — production's critical-CSS inlining emits a <link media=print onload=...> " +
        "that the production CSP's default-src blocks, so the global stylesheet (icon font, " +
        'Noto Sans Arabic, .page-heading etc.) never applies. This suite serves the build behind ' +
        'the same CSP (e2e/static-server.mjs) so it reproduces the bug until #118 disables ' +
        'inlineCritical for production.',
    );
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    const navIcon = page.locator('mat-icon').first();
    await expect(navIcon).toHaveCSS('font-family', /Material Symbols Outlined/);
    // `document.fonts.check()` returns true for an undeclared family too (it falls back to a
    // generic font that counts as "loaded"), so it can't tell a missing @font-face from a loaded
    // one — check the actual FontFaceSet entries instead, matching #118's acceptance criteria.
    const iconFontLoaded = await page.evaluate(() =>
      [...document.fonts].some(
        (font) =>
          font.family.replace(/^"|"$/g, '') === 'Material Symbols Outlined' &&
          font.status === 'loaded',
      ),
    );
    expect(iconFontLoaded).toBe(true);
  });

  test('the production CSP blocks nothing on load', async ({ page, cspViolations }) => {
    test.fixme(
      true,
      'Needs #118 — see the previous test; the inlined critical-CSS onload currently violates ' +
        "the production CSP's default-src on every load.",
    );
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect(cspViolations).toEqual([]);
  });

  test('navigates between the top-level pages', async ({ page }, testInfo) => {
    await page.goto('/');
    const nav = mainNav(page, testInfo.project.name);

    await nav.getByRole('link', { name: 'Habits' }).click();
    await expect(page).toHaveURL(/\/habits$/);
    await expect(page.getByTestId('page-title')).toHaveText('Habits');

    await nav.getByRole('link', { name: 'Plan' }).click();
    await expect(page).toHaveURL(/\/plan$/);
    await expect(page.getByTestId('page-title')).toHaveText('Plan');

    await nav.getByRole('link', { name: 'Journal' }).click();
    await expect(page).toHaveURL(/\/journal$/);
    await expect(page.getByTestId('page-title')).toHaveText('Journal');

    await nav.getByRole('link', { name: 'Settings' }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByTestId('page-title')).toHaveText('Settings');

    await nav.getByRole('link', { name: 'Home', exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId('page-title')).toHaveText('Home');
  });

  test('reload keeps a seeded document', async ({ page, seedDocument }) => {
    test.fixme(
      true,
      'Needs #35 (IndexedDB adapter) — the app still runs on the no-op adapter, so a seeded ' +
        'document has nowhere to be read from yet.',
    );
    await seedDocument({ settings: { language: 'en' } });
    await page.goto('/settings');
    await page.reload();
    // Once #35 lands: assert the seeded value is still reflected in the UI/store after reload.
  });

  test('switching language mirrors the layout', async ({ page, setLanguage }) => {
    test.fixme(
      true,
      'Needs #28 (i18n + RTL) — there is no language switcher yet and the app always renders en/ltr.',
    );
    await setLanguage('ar');
    await page.goto('/settings');
    // Once #28 lands: assert <html lang="ar" dir="rtl"> and that the shell nav mirrors.
  });

  test('works offline after the first load', async ({ page, goOffline }) => {
    test.fixme(
      true,
      'Needs #27 (PWA) — there is no service worker yet, so lazy feature chunks are not cached ' +
        'and navigation after going offline would fail for reasons unrelated to this harness.',
    );
    await page.goto('/');
    await goOffline();
    // Once #27 lands: assert navigation and the already-visited page still work offline.
  });

  for (const path of VISITED_PAGES) {
    test(`accessibility: ${path} has no serious or critical violations`, async ({ page }) => {
      await page.goto(path);
      const results = await new AxeBuilder({ page }).analyze();
      const seriousOrCritical = results.violations.filter(
        (violation) => violation.impact === 'serious' || violation.impact === 'critical',
      );
      expect(seriousOrCritical, JSON.stringify(seriousOrCritical, null, 2)).toEqual([]);
    });
  }
});
