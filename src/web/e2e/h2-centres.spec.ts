import AxeBuilder from '@axe-core/playwright';
import type { Page, TestInfo } from '@playwright/test';
import { expect, test } from './fixtures';
import { t, type Locale } from './i18n';

/**
 * Your centre (issue #60). Happy path from the hub: rate two centres, answer the four factors,
 * pick a suggested principle and type one, Save to the result, mark done, reload; the hub shows
 * the top centre. Plus backing out of an untouched draft stores nothing.
 */

function localeFor(testInfo: TestInfo): Locale {
  return testInfo.project.name.endsWith('-ar') ? 'ar' : 'en';
}

function textFor(locale: Locale) {
  const own = (key: string, params: Record<string, string | number> = {}) =>
    t(locale, 'h2Centres', key, params);
  const work = own('centre.work.title');
  return {
    hubTitle: t(locale, 'habits', 'exercises.h2-centres.shortTitle'),
    hubStatus: t(locale, 'habits', 'exercises.h2-centres.topCentre.work.other'),
    next: t(locale, 'exerciseKit', 'stepper.next'),
    integrity: t(locale, 'exerciseKit', 'principle.integrity'),
    save: own('editor.saveButton'),
    topRow: own('list.topCentreText', { centre: work }),
    workBar: own('result.ratingText', { centre: work, rating: 3, total: 3 }),
    markDone: t(locale, 'exerciseKit', 'doneToggle.markDone'),
    reopen: t(locale, 'exerciseKit', 'doneToggle.reopen'),
    checklistPrinciple: own('checklist.principle'),
  };
}

/** Copy from the app's own translation files (`e2e/i18n.ts`), never a literal (issue #228). */
const TEXT = { en: textFor('en'), ar: textFor('ar') };

const ROUTE = '/habits/h2/centres';
const SAVED_URL = /\/habits\/h2\/centres\/(?!new$)[^/]+$/;

/** The current step only. */
function activeStep(page: Page) {
  return page.locator(
    '.mat-horizontal-stepper-content-current, .mat-vertical-content-container-active',
  );
}

/** Next moves the step on the next change detection (zoneless), not during the click, so wait
 * for something only the new step holds before touching it. */
async function toStep(page: Page, next: string, marker: string): Promise<void> {
  await activeStep(page).getByRole('button', { name: next }).click();
  await expect(activeStep(page).locator(marker).first()).toBeVisible();
}

/** `habits.h2.centres` as IndexedDB holds it; `null` while the slice doesn't exist. */
async function storedCentres(page: Page): Promise<Record<string, unknown>[] | null> {
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
            resolve(get.result?.habits?.h2?.centres ?? null);
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
  await expect(page.locator('app-centres-result')).not.toBeVisible();
}

test.describe('Your centre (h2-centres)', () => {
  test('backing out of an untouched assessment leaves nothing', async ({ page }) => {
    await page.goto(ROUTE);
    await page.locator('.add-button').click();
    await expect(page).toHaveURL(/\/habits\/h2\/centres\/new$/);
    await expect(page.locator('app-centre-card')).toHaveCount(10);
    await page.goBack();
    await expect(page.locator('app-centre-card')).toHaveCount(0);
    // Longer than the 500 ms save debounce.
    await page.waitForTimeout(1000);
    expect(await storedCentres(page)).toBeNull();
  });

  test('assesses the centres from the hub, marks the exercise done, and it survives a reload', async ({
    page,
  }, testInfo) => {
    const text = TEXT[localeFor(testInfo)];
    const isMobile = testInfo.project.name.startsWith('mobile');

    await page.goto('/habits/h2');
    await page.locator('app-habit-hub-page mat-nav-list a', { hasText: text.hubTitle }).click();
    await expect(page).toHaveURL(/\/habits\/h2\/centres$/);
    await expect(
      page.locator('.done-checklist', { hasText: text.checklistPrinciple }),
    ).toBeVisible();

    await page.locator('.add-button').click();
    const cards = activeStep(page).locator('app-centre-card');
    await expect(cards).toHaveCount(10);
    // Work (4th card): "This is me"; Money (3rd): "Quite a lot".
    await cards.nth(3).locator('mat-button-toggle').nth(3).click();
    await expect(page).toHaveURL(SAVED_URL);
    await cards.nth(2).locator('mat-button-toggle').nth(2).click();
    await expect(cards.nth(2).locator('mat-button-toggle').nth(2)).toHaveClass(
      /mat-button-toggle-checked/,
    );

    await toStep(page, text.next, 'app-centres-factors textarea');
    const factors = activeStep(page).locator('app-centres-factors textarea');
    await expect(factors).toHaveCount(4);
    for (const [index, value] of [
      'Sure of myself after a good review.',
      'Take what looks best to my boss.',
      'Family time looks like lost time.',
      'I push hard when the project is hot.',
    ].entries()) {
      await factors.nth(index).fill(value);
    }

    await toStep(page, text.next, 'app-centres-principles mat-chip-option');
    await activeStep(page).locator('mat-chip-option', { hasText: text.integrity }).click();
    const customInput = activeStep(page).locator('.mat-mdc-chip-input');
    await customInput.fill('keeping my word');
    await customInput.press('Enter');
    // The chip's label, not the row: the row's text also holds the remove icon's ligature.
    await expect(
      activeStep(page).locator('mat-chip-row .mdc-evolution-chip__text-label'),
    ).toHaveText(['keeping my word']);

    await activeStep(page).getByRole('button', { name: text.save }).click();
    const result = page.locator('app-centres-result');
    await expect(result).toBeVisible();
    await expect(result.locator('.bar-track').first()).toHaveAttribute('aria-label', text.workBar);
    await expect(result.locator('.result-heading')).toBeFocused();
    await expect(result.locator('mat-chip .mdc-evolution-chip__text-label')).toHaveText([
      text.integrity,
      'keeping my word',
    ]);
    await closeEditor(page, isMobile);

    const row = page.locator('.assessment-history-list__item');
    await expect(row).toHaveCount(1);
    await expect(row).toContainText(text.topRow);

    const markDoneButton = page.locator('app-done-toggle button', { hasText: text.markDone });
    await expect(markDoneButton).toBeEnabled();
    await markDoneButton.click();
    await expect(page.locator('app-done-toggle', { hasText: text.reopen })).toBeVisible();

    await page.waitForTimeout(1000);
    await page.reload();
    await expect(page.locator('.assessment-history-list__item')).toHaveCount(1);
    await expect(page.locator('app-done-toggle', { hasText: text.reopen })).toBeVisible();
    const stored = await storedCentres(page);
    expect(stored?.[0]?.['ratings']).toEqual({ work: 3, money: 2 });
    expect(stored?.[0]?.['principles']).toEqual([
      { key: 'integrity' },
      { name: 'keeping my word' },
    ]);

    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical'),
    ).toEqual([]);

    await page.goto('/habits/h2');
    await expect(
      page
        .locator('app-habit-hub-page mat-nav-list a', { hasText: text.hubTitle })
        .locator('.hub-status'),
    ).toContainText(text.hubStatus);
  });
});
