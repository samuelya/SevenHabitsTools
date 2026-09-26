import AxeBuilder from '@axe-core/playwright';
import type { Page, TestInfo } from '@playwright/test';
import { expect, test } from './fixtures';
import { t, type Locale } from './i18n';

/**
 * Your long view (issue #58). Happy path from the hub: pick "Your last day at work", answer both
 * prompts with a value chip, read it back, close, see the values summary, mark done, reload. Plus
 * backing out of the picker stores nothing.
 */

function localeFor(testInfo: TestInfo): Locale {
  return testInfo.project.name.endsWith('-ar') ? 'ar' : 'en';
}

function textFor(locale: Locale) {
  const own = (key: string, params: Record<string, string | number> = {}) =>
    t(locale, 'h2LongView', key, params);
  return {
    hubTitle: t(locale, 'habits', 'exercises.h2-long-view.shortTitle'),
    lastDay: own('scenario.lastDay.title'),
    next: t(locale, 'exerciseKit', 'stepper.next'),
    scenarios: own('summary.scenariosText', { count: 1 }),
    markDone: t(locale, 'exerciseKit', 'doneToggle.markDone'),
    reopen: t(locale, 'exerciseKit', 'doneToggle.reopen'),
    checklistValue: own('checklist.value'),
  };
}

/** Copy from the app's own translation files (`e2e/i18n.ts`), never a literal (issue #228). */
const TEXT = { en: textFor('en'), ar: textFor('ar') };

const ROUTE = '/habits/h2/long-view';
const SAVED_URL = /\/habits\/h2\/long-view\/(?!new$)[^/]+$/;

/** `habits.h2.longViews` as IndexedDB holds it; `null` while the slice doesn't exist. */
async function storedLongViews(page: Page): Promise<Record<string, unknown>[] | null> {
  return page.evaluate(
    () =>
      new Promise<Record<string, unknown>[] | null>((resolve, reject) => {
        const open = indexedDB.open('sevenhabits');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains('documents')) {
            db.close();
            resolve(null);
            return;
          }
          const get = db.transaction('documents').objectStore('documents').get('current');
          get.onsuccess = () => {
            db.close();
            resolve(get.result?.habits?.h2?.longViews ?? null);
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
  await expect(page.locator('app-guided-stepper')).not.toBeVisible();
}

test.describe('Your long view (h2-long-view)', () => {
  test('backing out of the picker leaves nothing', async ({ page }) => {
    await page.goto(ROUTE);
    await page.locator('.add-button').click();
    await expect(page).toHaveURL(/\/habits\/h2\/long-view\/new$/);
    await expect(page.locator('.scenario-card').first()).toBeFocused();
    await page.goBack();
    await expect(page.locator('.scenario-card')).toHaveCount(0);
    // Longer than the 500 ms save debounce.
    await page.waitForTimeout(1000);
    expect(await storedLongViews(page)).toBeNull();
  });

  test('writes a long view from the hub, marks the exercise done, and it survives a reload', async ({
    page,
  }, testInfo) => {
    const text = TEXT[localeFor(testInfo)];
    const isMobile = testInfo.project.name.startsWith('mobile');

    await page.goto('/habits/h2');
    await page.locator('app-habit-hub-page mat-nav-list a', { hasText: text.hubTitle }).click();
    await expect(page).toHaveURL(/\/habits\/h2\/long-view$/);
    await expect(page.locator('app-long-view-summary')).toHaveCount(0);
    await expect(page.locator('.done-checklist', { hasText: text.checklistValue })).toBeVisible();

    await page.locator('.add-button').click();
    await page.locator('.scenario-card', { hasText: text.lastDay }).click();

    const answer = page.locator('app-long-view-prompt textarea:visible');
    await expect(answer).toBeFocused();
    await answer.fill('Two products people still use.');
    await expect(page).toHaveURL(SAVED_URL);
    const chipInput = page.locator('app-long-view-prompt .mat-mdc-chip-input:visible');
    await chipInput.fill('craft');
    await chipInput.press('Enter');
    await expect(page.locator('app-long-view-prompt mat-chip-row:visible')).toHaveText(['craft']);
    await page.locator('app-guided-stepper button:visible', { hasText: text.next }).click();

    await page.locator('app-long-view-prompt textarea:visible').fill('Teach two mornings a week.');
    await page.locator('app-guided-stepper button:visible', { hasText: text.next }).click();
    await page.locator('app-reflection-editor textarea:visible').fill('Everyone mentioned time.');
    await closeEditor(page, isMobile);

    await expect(page.locator('.assessment-history-list__item')).toHaveCount(1);
    await expect(page.locator('.assessment-history-list__item')).toContainText(text.lastDay);
    const summary = page.locator('app-long-view-summary');
    await expect(summary.locator('mat-chip')).toHaveText(['craft']);
    await expect(summary).toContainText(text.scenarios);

    const markDoneButton = page.locator('app-done-toggle button', { hasText: text.markDone });
    await expect(markDoneButton).toBeEnabled();
    await markDoneButton.click();
    await expect(page.locator('app-done-toggle', { hasText: text.reopen })).toBeVisible();

    await page.waitForTimeout(1000);
    await page.reload();
    await expect(page.locator('.assessment-history-list__item')).toHaveCount(1);
    await expect(page.locator('app-done-toggle', { hasText: text.reopen })).toBeVisible();
    const stored = await storedLongViews(page);
    expect(stored?.[0]?.['scenario']).toBe('lastDay');
    expect(stored?.[0]?.['reflection']).toBe('Everyone mentioned time.');

    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical'),
    ).toEqual([]);

    await page.goto('/habits/h2');
    await expect(
      page
        .locator('app-habit-hub-page mat-nav-list a', { hasText: text.hubTitle })
        .locator('.hub-status'),
    ).toBeVisible();
  });
});
