import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { t, type Locale } from './i18n';

/**
 * "Your words" (issue #54), a list exercise on the Habit 1 hub. Happy path from the hub: start a
 * listening day, catch a phrase that gives the choice away and rewrite it, end the day, read the
 * summary, mark done, and everything survives a reload. A second test lets the fake clock run past
 * the 24 hours. No `seedDocument`, so each project renders its own locale.
 */

function localeFor(projectName: string): Locale {
  return projectName.endsWith('-ar') ? 'ar' : 'en';
}

function textFor(locale: Locale) {
  const language = (key: string) => t(locale, 'h1Language', key);
  return {
    hubTitle: t(locale, 'habits', 'exercises.h1-language.shortTitle'),
    checklistItem: language('checklist.day'),
    proactive: language('kind.proactive'),
    endedTitle: language('day.endedTitle'),
    markDone: t(locale, 'exerciseKit', 'doneToggle.markDone'),
    reopen: t(locale, 'exerciseKit', 'doneToggle.reopen'),
  };
}

const TEXT = { en: textFor('en'), ar: textFor('ar') };

/** The stored slice, as IndexedDB (and so the JSON export) holds it. */
async function stored(
  page: Page,
): Promise<{ phrases: Record<string, unknown>[]; listeningDays: Record<string, unknown>[] }> {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open('sevenhabits');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const get = db.transaction('documents').objectStore('documents').get('current');
          get.onsuccess = () => {
            db.close();
            resolve(get.result?.habits?.h1?.language ?? { phrases: [], listeningDays: [] });
          };
          get.onerror = () => reject(get.error);
        };
      }),
  );
}

async function closeEditor(page: Page, isMobile: boolean): Promise<void> {
  if (isMobile) {
    await page.goBack();
  } else {
    await page.locator('app-exercise-page .editor-close').click();
  }
  await expect(page.locator('app-language-item-form')).toHaveCount(0);
}

test.describe('h1 your words', () => {
  test('runs a listening day, rewrites a phrase, marks done, and it survives a reload', async ({
    page,
  }, testInfo) => {
    const text = TEXT[localeFor(testInfo.project.name)];
    const isMobile = testInfo.project.name.startsWith('mobile');

    await page.goto('/habits/h1');
    await page.locator('app-habit-hub-page mat-nav-list a', { hasText: text.hubTitle }).click();
    await expect(page).toHaveURL(/\/habits\/h1\/language$/);
    await expect(page.locator('app-language-week')).toHaveCount(0);
    await expect(page.locator('.done-checklist', { hasText: text.checklistItem })).toBeVisible();

    await page.locator('.start-day-button').click();
    await expect(page.locator('.banner-region')).toHaveAttribute('aria-live', 'polite');
    await expect(page.locator('.day-banner')).toContainText('24');

    // A phrase that gives the choice away, rewritten.
    await page.locator('.add-button').click();
    await expect(page).toHaveURL(/\/habits\/h1\/language\/new$/);
    const form = page.locator('app-language-item-form');
    await expect(form.locator('textarea').first()).toBeFocused();
    await form.locator('textarea').first().fill('I have to stay late again.');
    await expect(page).toHaveURL(/\/habits\/h1\/language\/(?!new$)[^/]+$/);
    await form.locator('textarea').nth(1).fill("I'll stay till six tonight.");
    await closeEditor(page, isMobile);

    // One that owns the choice: no rewrite field.
    await page.locator('.add-button').click();
    await form.locator('textarea').first().fill("I'll take the early train.");
    await form.locator('mat-radio-button', { hasText: text.proactive }).locator('input').check();
    await expect(form.locator('textarea')).toHaveCount(1);
    await closeEditor(page, isMobile);

    await expect(page.locator('app-language-week tbody tr')).toHaveCount(7);
    await expect(page.locator('app-language-week .streak')).toBeVisible();

    await page.locator('.end-day-button').click();
    await expect(page.locator('.day-banner')).toHaveCount(0);
    await expect(page.locator('.day-summary')).toContainText(text.endedTitle);
    await expect(page.locator('.new-day-button')).toBeVisible();

    const markDone = page.locator('app-done-toggle button', { hasText: text.markDone });
    await expect(markDone).toBeEnabled();
    await markDone.click();
    await expect(page.locator('app-done-toggle', { hasText: text.reopen })).toBeVisible();

    // Longer than the 500 ms save debounce (`document-persistence.ts`).
    await page.waitForTimeout(1000);
    const saved = await stored(page);
    expect(saved.listeningDays).toHaveLength(1);
    expect(saved.listeningDays[0]['endedAt']).toEqual(expect.any(String));
    expect(saved.phrases).toHaveLength(2);
    expect(saved.phrases.every((p) => p['listeningDayId'] === saved.listeningDays[0]['id'])).toBe(
      true,
    );

    await page.reload();
    await expect(page.locator('.exercise-list__item')).toHaveCount(2);
    await expect(page.locator('.day-summary')).toBeVisible();
    await expect(page.locator('app-done-toggle', { hasText: text.reopen })).toBeVisible();
  });

  test('a listening day ends by itself 24 hours after it started', async ({ page }, testInfo) => {
    const text = TEXT[localeFor(testInfo.project.name)];
    await page.clock.install({ time: new Date('2026-03-10T08:00:00') });
    await page.goto('/habits/h1/language');

    await page.locator('.start-day-button').click();
    await expect(page.locator('.day-banner')).toBeVisible();

    await page.clock.runFor('23:59:00');
    await expect(page.locator('.day-banner')).toBeVisible();

    // The minute timer, at most one minute after the mark.
    await page.clock.runFor('02:00');
    await expect(page.locator('.day-banner')).toHaveCount(0);
    await expect(page.locator('.day-summary')).toContainText(text.endedTitle);

    await page.waitForTimeout(1000);
    expect((await stored(page)).listeningDays[0]['endedAt']).toBeUndefined();
  });

  test('accessibility: the page with a running day has no serious or critical violations', async ({
    page,
  }) => {
    await page.goto('/habits/h1/language');
    await page.locator('.start-day-button').click();
    await expect(page.locator('.day-banner')).toBeVisible();
    // The banner makes the page taller than a 1280x800 viewport, so at `scrollTop: 0` the
    // scaffold's sticky footer (#184) paints over "Add phrase" and axe reads the footer's disabled
    // "Mark done" fill as the label's background. Scrolled to the end, the footer sits after the
    // content and covers nothing.
    await page.locator('.page').evaluate((el) => el.scrollTo(0, el.scrollHeight));
    const addBox = await page.locator('.add-button').boundingBox();
    const footerBox = await page.locator('app-exercise-page .footer-slot').boundingBox();
    expect(addBox!.y + addBox!.height).toBeLessThanOrEqual(footerBox!.y);
    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical'),
    ).toEqual([]);
  });

  test('accessibility: the open editor has no serious or critical violations', async ({ page }) => {
    await page.goto('/habits/h1/language');
    await page.locator('.add-button').click();
    const form = page.locator('app-language-item-form');
    await form.locator('textarea').first().fill('They made me do it.');
    await expect(form.locator('textarea')).toHaveCount(2);

    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical'),
    ).toEqual([]);
  });
});
