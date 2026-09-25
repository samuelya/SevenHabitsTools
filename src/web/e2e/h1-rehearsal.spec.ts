import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { t, type Locale } from './i18n';

/**
 * "Rehearse it" (issue #55), a list exercise on the Habit 1 hub. Happy path from the hub: add a
 * rehearsal for today, fill the four parts (which makes a promise in Your promises), follow it up
 * ("As I planned" pre-selects Kept; Save resolves the promise), mark the exercise done, and it all
 * survives a reload. No `seedDocument`, so each project renders its own locale.
 */

function localeFor(projectName: string): Locale {
  return projectName.endsWith('-ar') ? 'ar' : 'en';
}

function textFor(locale: Locale) {
  const rehearsal = (key: string) => t(locale, 'h1Rehearsal', key);
  const promiseText = (status: string) =>
    rehearsal('form.promiseStatusText').replace('{{status}}', rehearsal(`promiseStatus.${status}`));
  return {
    hubTitle: t(locale, 'habits', 'exercises.h1-rehearsal.shortTitle'),
    checklistItem: rehearsal('checklist.trigger'),
    yes: rehearsal('happened.yes'),
    asPlanned: rehearsal('result.chosen'),
    kept: rehearsal('kept.kept'),
    followedUp: rehearsal('status.followedUp'),
    promiseOpen: promiseText('open'),
    promiseKept: promiseText('kept'),
    markDone: t(locale, 'exerciseKit', 'doneToggle.markDone'),
    reopen: t(locale, 'exerciseKit', 'doneToggle.reopen'),
  };
}

const TEXT = { en: textFor('en'), ar: textFor('ar') };

/** Today's local date, `YYYY-MM-DD`: ISO is read in every locale (`parseLocalDate`). */
function today(): string {
  const date = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The stored rehearsals and promises, as IndexedDB (and so the JSON export) holds them. */
async function stored(page: Page): Promise<{ rehearsals: unknown[]; commitments: unknown[] }> {
  return page.evaluate(
    () =>
      new Promise<{ rehearsals: unknown[]; commitments: unknown[] }>((resolve, reject) => {
        const open = indexedDB.open('sevenhabits');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const get = db.transaction('documents').objectStore('documents').get('current');
          get.onsuccess = () => {
            db.close();
            resolve({
              rehearsals: get.result?.habits?.h1?.rehearsals ?? [],
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
  await expect(page.locator('app-rehearsal-item-form')).toHaveCount(0);
}

test.describe('h1 rehearsal', () => {
  test('rehearses a moment, makes and keeps the promise, marks done, and it survives a reload', async ({
    page,
  }, testInfo) => {
    const text = TEXT[localeFor(testInfo.project.name)];
    const isMobile = testInfo.project.name.startsWith('mobile');

    await page.goto('/habits/h1');
    await page.locator('app-habit-hub-page mat-nav-list a', { hasText: text.hubTitle }).click();
    await expect(page).toHaveURL(/\/habits\/h1\/rehearsal$/);
    await expect(page.locator('app-rehearsal-summary')).toHaveCount(0);
    await expect(page.locator('.done-checklist', { hasText: text.checklistItem })).toBeVisible();

    await page.locator('.add-button').click();
    await expect(page).toHaveURL(/\/habits\/h1\/rehearsal\/new$/);
    const form = page.locator('app-rehearsal-item-form');
    const textareas = form.locator('textarea');
    await expect(textareas.first()).toBeFocused();
    await textareas.first().fill('Sunday lunch, when Dad brings up my job again.');
    await expect(page).toHaveURL(/\/habits\/h1\/rehearsal\/(?!new$)[^/]+$/);
    await textareas.nth(1).fill('I get short with him and leave the table early.');
    await textareas.nth(2).fill('The whole afternoon feels ruined.');
    await textareas
      .nth(3)
      .fill('I take a breath and say: "Ask me one question and I will answer properly."');
    await form.locator('.promise-input').fill('Answer Dad calmly and ask him one question back.');
    await expect(form.locator('.promise-status')).toHaveCount(0);

    // Today: the promise is made, and Afterwards opens.
    await form.locator('.date-field input').fill(today());
    await form.locator('.date-field input').press('Tab');
    await expect(form.locator('.promise-status')).toHaveText(text.promiseOpen);

    const followUp = form.locator('app-rehearsal-follow-up');
    await followUp.locator('mat-radio-button', { hasText: text.yes }).locator('input').check();
    await followUp
      .locator('mat-radio-button', { hasText: text.asPlanned })
      .locator('input')
      .check();
    await expect(
      followUp.locator('mat-radio-button', { hasText: text.kept }).locator('input'),
    ).toBeChecked();
    await followUp.locator('.save-button').click();
    await expect(form.locator('.promise-status')).toHaveText(text.promiseKept);
    await closeEditor(page, isMobile);

    await expect(page.locator('.exercise-list__item')).toContainText(text.followedUp);
    await expect(page.locator('app-rehearsal-summary')).toBeVisible();
    const markDone = page.locator('app-done-toggle button', { hasText: text.markDone });
    await expect(markDone).toBeEnabled();
    await markDone.click();
    await expect(page.locator('app-done-toggle', { hasText: text.reopen })).toBeVisible();

    // Longer than the 500 ms save debounce (`document-persistence.ts`).
    await page.waitForTimeout(1000);
    const saved = await stored(page);
    expect(saved.rehearsals).toHaveLength(1);
    expect(saved.rehearsals[0]).toMatchObject({
      expectedOn: today(),
      followUp: { happened: true, result: 'chosen', kept: 'kept' },
    });
    expect(saved.commitments).toHaveLength(1);
    expect(saved.commitments[0]).toMatchObject({
      toWhom: 'self',
      status: 'kept',
      dueDate: today(),
      source: { exerciseId: 'h1-rehearsal' },
    });

    await page.reload();
    await expect(page.locator('.exercise-list__item')).toHaveCount(1);
    await expect(page.locator('app-done-toggle', { hasText: text.reopen })).toBeVisible();
  });

  test('accessibility: the exercise page has no serious or critical violations', async ({
    page,
  }) => {
    await page.goto('/habits/h1/rehearsal');
    await expect(page.locator('.add-button')).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical'),
    ).toEqual([]);
  });

  test('accessibility: the open editor with Afterwards has no serious or critical violations', async ({
    page,
  }) => {
    await page.goto('/habits/h1/rehearsal');
    await page.locator('.add-button').click();
    const form = page.locator('app-rehearsal-item-form');
    await form.locator('textarea').first().fill('Sunday lunch.');
    await form.locator('.date-field input').fill(today());
    await form.locator('.date-field input').press('Tab');
    const followUp = form.locator('app-rehearsal-follow-up');
    await expect(followUp).toBeVisible();
    await followUp.locator('mat-radio-button').first().locator('input').check();
    await expect(followUp.locator('.save-button')).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical'),
    ).toEqual([]);
  });
});
