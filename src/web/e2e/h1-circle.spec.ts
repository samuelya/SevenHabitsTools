import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { t, type Locale } from './i18n';

/**
 * "Your influence" (issue #53), a list exercise on the Habit 1 hub. Happy path from the hub: add a
 * concern you can affect, write a first step, make it a promise, mark the step taken, then add one
 * that is out of anyone's hands and let it go; the two groups show in order, Mark done is enabled,
 * and everything survives a reload. No `seedDocument`, so each project renders its own locale.
 */

function localeFor(projectName: string): Locale {
  return projectName.endsWith('-ar') ? 'ar' : 'en';
}

function textFor(locale: Locale) {
  const circle = (key: string) => t(locale, 'h1Circle', key);
  return {
    hubTitle: t(locale, 'habits', 'exercises.h1-circle.shortTitle'),
    checklistItem: circle('checklist.concern'),
    indirect: circle('control.indirect'),
    none: circle('control.none'),
    stepTaken: circle('status.stepTaken'),
    letGo: circle('status.letGo'),
    makePromise: circle('form.makePromiseButton'),
    promiseOpen: circle('form.promiseStatusText').replace(
      '{{status}}',
      circle('promiseStatus.open'),
    ),
    seePromise: circle('form.seePromiseButton'),
    affectLegend: circle('group.influenceLegend'),
    concernLegend: circle('group.concernLegend'),
    markDone: t(locale, 'exerciseKit', 'doneToggle.markDone'),
    reopen: t(locale, 'exerciseKit', 'doneToggle.reopen'),
  };
}

const TEXT = { en: textFor('en'), ar: textFor('ar') };

/** The stored concerns and promises, as IndexedDB (and so the JSON export) holds them. */
async function stored(page: Page): Promise<{ concerns: unknown[]; commitments: unknown[] }> {
  return page.evaluate(
    () =>
      new Promise<{ concerns: unknown[]; commitments: unknown[] }>((resolve, reject) => {
        const open = indexedDB.open('sevenhabits');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const get = db.transaction('documents').objectStore('documents').get('current');
          get.onsuccess = () => {
            db.close();
            resolve({
              concerns: get.result?.habits?.h1?.concerns ?? [],
              commitments: get.result?.shared?.commitments ?? [],
            });
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
  await expect(page.locator('app-circle-item-form')).toHaveCount(0);
}

test.describe('h1 circle of influence', () => {
  test('sorts two concerns, makes a promise, marks done, and it survives a reload', async ({
    page,
  }, testInfo) => {
    const text = TEXT[localeFor(testInfo.project.name)];
    const isMobile = testInfo.project.name.startsWith('mobile');

    await page.goto('/habits/h1');
    await page.locator('app-habit-hub-page mat-nav-list a', { hasText: text.hubTitle }).click();
    await expect(page).toHaveURL(/\/habits\/h1\/circle$/);
    await expect(page.locator('app-circle-summary')).toHaveCount(0);
    await expect(page.locator('.group-heading')).toHaveCount(0);
    await expect(page.locator('.done-checklist', { hasText: text.checklistItem })).toBeVisible();

    // Branch A: up to others too, a first step, a promise, then Step taken.
    await page.locator('.add-button').click();
    await expect(page).toHaveURL(/\/habits\/h1\/circle\/new$/);
    const form = page.locator('app-circle-item-form');
    await expect(form.locator('textarea').first()).toBeFocused();
    await form.locator('textarea').first().fill('My manager keeps changing the deadline.');
    await expect(page).toHaveURL(/\/habits\/h1\/circle\/(?!new$)[^/]+$/);
    await form.locator('mat-radio-button', { hasText: text.indirect }).locator('input').check();
    await form.locator('textarea').nth(1).fill('Ask for a 10-minute chat.');
    await form.locator('.make-promise-button').click();
    await expect(form.locator('.promise-status')).toHaveText(text.promiseOpen);
    await expect(form.locator('.see-promise-link')).toHaveAttribute(
      'href',
      /\/habits\/h1\/commitments\/[^/]+$/,
    );
    await form.locator('mat-button-toggle', { hasText: text.stepTaken }).click();
    await closeEditor(page, isMobile);

    // Branch B: out of anyone's hands, a line on letting it go, then Let go.
    await page.locator('.add-button').click();
    await form.locator('textarea').first().fill('The bus is always late in winter.');
    await form.locator('mat-radio-button', { hasText: text.none }).locator('input').check();
    await expect(form.locator('.make-promise-button')).toHaveCount(0);
    await form.locator('textarea').nth(1).fill('Leave ten minutes earlier and read.');
    await form.locator('mat-button-toggle', { hasText: text.letGo }).click();
    await closeEditor(page, isMobile);

    await expect(page.locator('.group-heading')).toHaveText([
      text.affectLegend,
      text.concernLegend,
    ]);
    await expect(page.locator('app-circle-summary')).toBeVisible();
    const markDone = page.locator('app-done-toggle button', { hasText: text.markDone });
    await expect(markDone).toBeEnabled();
    await markDone.click();
    await expect(page.locator('app-done-toggle', { hasText: text.reopen })).toBeVisible();

    // Longer than the 500 ms save debounce (`document-persistence.ts`).
    await page.waitForTimeout(1000);
    const saved = await stored(page);
    expect(saved.concerns).toHaveLength(2);
    expect(saved.commitments).toHaveLength(1);
    expect(saved.commitments[0]).toMatchObject({
      toWhom: 'self',
      source: { exerciseId: 'h1-circle' },
    });

    await page.reload();
    await expect(page.locator('.exercise-list__item')).toHaveCount(2);
    await expect(page.locator('app-done-toggle', { hasText: text.reopen })).toBeVisible();

    await page.goto('/habits/h1');
    await expect(
      page.locator('app-habit-hub-page mat-nav-list a', { hasText: text.hubTitle }),
    ).toBeVisible();
  });

  test('accessibility: the exercise page has no serious or critical violations', async ({
    page,
  }) => {
    await page.goto('/habits/h1/circle');
    await expect(page.locator('.add-button')).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical'),
    ).toEqual([]);
  });

  test('accessibility: the open editor has no serious or critical violations', async ({ page }) => {
    await page.goto('/habits/h1/circle');
    await page.locator('.add-button').click();
    const form = page.locator('app-circle-item-form');
    await form.locator('textarea').first().fill('The deadline keeps moving.');
    await form.locator('textarea').nth(1).fill('Ask for a chat.');
    await expect(form.locator('.make-promise-button')).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical'),
    ).toEqual([]);
  });
});
