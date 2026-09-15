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
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect(cspViolations).toEqual([]);
  });

  test('the served index.html never reintroduces a print-gated stylesheet link', async ({
    page,
  }) => {
    // Direct regression guard for #118: the two tests above catch the symptom (font/CSP), this
    // one catches the exact cause — Angular's critical-CSS inlining emitting a
    // `<link media="print" onload="...">` that only swaps to `all` via a CSP-blocked inline
    // handler. Asserts against the raw served HTML so a future change to `angular.json`
    // (`optimization.styles.inlineCritical`) fails here immediately instead of only downstream.
    const response = await page.goto('/');
    const html = (await response?.text()) ?? '';
    const stylesheetLinks = [...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*>/g)].map(
      (match) => match[0],
    );
    expect(stylesheetLinks.length).toBeGreaterThan(0);
    for (const link of stylesheetLinks) {
      expect(link).not.toContain('media="print"');
      expect(link).not.toContain('onload=');
    }
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
    await seedDocument({ settings: { language: 'en' } });
    await page.goto('/settings');
    await page.reload();
    await page.waitForLoadState('networkidle');

    // No feature reads `settings` into the UI yet (#28), so assert against IndexedDB itself
    // rather than the DOM: the seeded value must still be there, not replaced by a fresh empty
    // document (which would mean the adapter's `load()` didn't return it, or the bootstrap
    // treated it as corrupt).
    const stored = await page.evaluate(
      () =>
        new Promise((resolve, reject) => {
          const request = indexedDB.open('sevenhabits');
          request.onsuccess = () => {
            const db = request.result;
            const tx = db.transaction('documents', 'readonly');
            const getRequest = tx.objectStore('documents').get('current');
            getRequest.onsuccess = () => resolve(getRequest.result);
            getRequest.onerror = () => reject(getRequest.error);
          };
          request.onerror = () => reject(request.error);
        }),
    );
    expect(stored).toMatchObject({ settings: { language: 'en' } });
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

  test('works offline after the first load', async ({ page, goOffline }, testInfo) => {
    await page.goto('/');
    // The service worker never controls the load that registers it (only future navigations do),
    // so reload once while still online: this second load is fully served — and, for anything not
    // already prefetched as part of the app shell, cached — through it (ngsw-config.json).
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await page.waitForLoadState('networkidle');

    const nav = mainNav(page, testInfo.project.name);
    await nav.getByRole('link', { name: 'Habits' }).click();
    await expect(page).toHaveURL(/\/habits$/);

    await goOffline();
    await page.reload();
    await expect(page.getByTestId('page-title')).toHaveText('Habits');

    // Client-side navigation back to an already-loaded route: no network needed either way, but
    // exercises the same offline app instance a user would actually be poking at.
    await nav.getByRole('link', { name: 'Home', exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Seven Habits Tools');
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
