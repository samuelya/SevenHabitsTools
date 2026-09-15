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

/**
 * Shell copy in both languages, so specs that don't seed a language (and therefore render
 * whichever language the project's own locale defaults to — see `playwright.config.ts`'s
 * `mobile-ar`/`desktop-ar` projects) can assert against the right one instead of hardcoding `en`.
 */
const SHELL_TEXT = {
  en: {
    appName: 'Seven Habits Tools',
    home: 'Home',
    habits: 'Habits',
    plan: 'Plan',
    journal: 'Journal',
    settings: 'Settings',
  },
  ar: {
    appName: 'أدوات العادات السبع',
    home: 'الرئيسية',
    habits: 'العادات',
    plan: 'التخطيط',
    journal: 'المذكرات',
    settings: 'الإعدادات',
  },
} as const;

function localeFor(projectName: string): keyof typeof SHELL_TEXT {
  return projectName.endsWith('-ar') ? 'ar' : 'en';
}

/** Every registered habit hub id (`core/habits/habits.ts`'s `HABIT_IDS`) — kept in sync by hand,
 * same as `VISITED_PAGES` above, since these routes are generated from it rather than listed in
 * the route registry. */
const HABIT_HUB_IDS = [
  'paradigms',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'h7',
  'interdependence',
] as const;

/** Every route this app registers: the six top-level pages plus every habit hub. */
const ALL_ROUTES = [...VISITED_PAGES, ...HABIT_HUB_IDS.map((id) => `/habits/${id}`)];

/** A route or page title that never resolved — issue #149 — looks exactly like its own Transloco
 * key (e.g. `titles.about`, `about.title`): a run of dot-separated identifier segments. */
const RAW_KEY_PATTERN = /^[a-z0-9]+(\.[a-z0-9]+)+$/i;

test.describe('app shell smoke', () => {
  test('loads the home page', async ({ page }, testInfo) => {
    const text = SHELL_TEXT[localeFor(testInfo.project.name)];
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(text.appName);
    await expect(page).toHaveTitle(`${text.home} | ${text.appName}`);
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
    const text = SHELL_TEXT[localeFor(testInfo.project.name)];
    await page.goto('/');
    const nav = mainNav(page, testInfo.project.name);

    await nav.getByRole('link', { name: text.habits }).click();
    await expect(page).toHaveURL(/\/habits$/);
    await expect(page.getByTestId('page-title')).toHaveText(text.habits);

    await nav.getByRole('link', { name: text.plan }).click();
    await expect(page).toHaveURL(/\/plan$/);
    await expect(page.getByTestId('page-title')).toHaveText(text.plan);

    await nav.getByRole('link', { name: text.journal }).click();
    await expect(page).toHaveURL(/\/journal$/);
    await expect(page.getByTestId('page-title')).toHaveText(text.journal);

    await nav.getByRole('link', { name: text.settings }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByTestId('page-title')).toHaveText(text.settings);

    await nav.getByRole('link', { name: text.home, exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId('page-title')).toHaveText(text.home);
  });

  for (const lang of ['en', 'ar'] as const) {
    test(`every route resolves a translated title, not a raw key (${lang})`, async ({
      page,
      setLanguage,
    }) => {
      // Regression test for #149: a direct deep link — the shell asking for the title before the
      // routed page's own `transloco` pipe usage has had a chance to warm anything — is what
      // reproduced it; in-app navigation (the test above) does not. `expect.poll` because the
      // title is correctly reactive (it resolves once loaded, over the network, same as the
      // page's own content) rather than necessarily present on the very first paint — #149 was
      // that it never resolved at all, not that it was merely late.
      await setLanguage(lang);
      for (const path of ALL_ROUTES) {
        await page.goto(path);
        await expect
          .poll(() => page.getByTestId('page-title').textContent())
          .not.toMatch(RAW_KEY_PATTERN);
        expect(await page.title()).not.toMatch(RAW_KEY_PATTERN);
      }
    });
  }

  test('a live language switch re-translates the current page title, without navigating', async ({
    page,
    setLanguage,
  }) => {
    await setLanguage('en');
    await page.goto('/habits/h2');
    await expect(page.getByTestId('page-title')).toHaveText('Habit 2: Begin with the end in mind');

    await page.getByRole('button', { name: 'Switch to Arabic' }).click();

    await expect(page.getByTestId('page-title')).toHaveText('العادة 2: ابدأ والغاية في ذهنك');
    await expect(page).toHaveTitle(/^العادة 2: ابدأ والغاية في ذهنك \| /);
  });

  test('reload keeps a seeded document', async ({ page, seedDocument }) => {
    await seedDocument({ settings: { language: 'en' } });
    await page.goto('/settings');
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Assert against IndexedDB itself rather than the DOM: the seeded value must still be there,
    // not replaced by a fresh empty document (which would mean the adapter's `load()` didn't
    // return it, or the bootstrap treated it as corrupt).
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

  test('switching language mirrors the layout', async ({ page, setLanguage }, testInfo) => {
    await setLanguage('ar');
    await page.goto('/');

    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    // The home page's own copy, not just the attributes, actually renders in Arabic.
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('أدوات العادات السبع');

    if (testInfo.project.name.startsWith('desktop')) {
      // The side nav mirrors to the end (right) edge of the viewport instead of the start (left).
      const box = await page.locator('mat-sidenav').boundingBox();
      const viewport = page.viewportSize();
      expect(box).not.toBeNull();
      expect(viewport).not.toBeNull();
      expect(box!.x + box!.width).toBeCloseTo(viewport!.width, 0);
    }
  });

  test('works offline after the first load', async ({ page, goOffline }, testInfo) => {
    const text = SHELL_TEXT[localeFor(testInfo.project.name)];
    await page.goto('/');
    // The service worker never controls the load that registers it (only future navigations do),
    // so reload once while still online: this second load is fully served — and, for anything not
    // already prefetched as part of the app shell, cached — through it (ngsw-config.json).
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await page.waitForLoadState('networkidle');

    const nav = mainNav(page, testInfo.project.name);
    await nav.getByRole('link', { name: text.habits }).click();
    await expect(page).toHaveURL(/\/habits$/);

    await goOffline();
    await page.reload();
    await expect(page.getByTestId('page-title')).toHaveText(text.habits);

    // Client-side navigation back to an already-loaded route: no network needed either way, but
    // exercises the same offline app instance a user would actually be poking at.
    await nav.getByRole('link', { name: text.home, exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(text.appName);
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
