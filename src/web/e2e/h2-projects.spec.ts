import AxeBuilder from '@axe-core/playwright';
import type { TestInfo } from '@playwright/test';
import { expect, test } from './fixtures';
import { t, type Locale } from './i18n';

/**
 * Your projects (issue #65). Happy path from the hub: name a project, see the steps locked until
 * "What done looks like" has text, add two steps and reorder them, check the hub's "1 under way",
 * tick both steps, take the inline "Mark project Done", see it under Finished, mark the exercise
 * done and reload.
 */

function localeFor(testInfo: TestInfo): Locale {
  return testInfo.project.name.endsWith('-ar') ? 'ar' : 'en';
}

function textFor(locale: Locale) {
  const own = (key: string) => t(locale, 'h2Projects', key);
  return {
    hubTitle: t(locale, 'habits', 'exercises.h2-projects.shortTitle'),
    hubStatus: t(
      locale,
      'habits',
      `exercises.h2-projects.underWayCount.${new Intl.PluralRules(locale).select(1)}`,
      { count: 1 },
    ),
    lockedHint: own('steps.lockedHint'),
    markProjectDone: own('steps.markProjectDoneButton'),
    finished: own('group.finishedLegend'),
    markDone: t(locale, 'exerciseKit', 'doneToggle.markDone'),
    reopen: t(locale, 'exerciseKit', 'doneToggle.reopen'),
  };
}

/** Copy from the app's own translation files (`e2e/i18n.ts`), never a literal (issue #228). */
const TEXT = { en: textFor('en'), ar: textFor('ar') };

const ROUTE = '/habits/h2/projects';
const SAVED_URL = /\/habits\/h2\/projects\/(?!new$)[^/]+$/;

test.describe('Your projects (h2-projects)', () => {
  test('plans a project from the result, finishes it, marks done, and survives a reload', async ({
    page,
  }, testInfo) => {
    const text = TEXT[localeFor(testInfo)];
    const isMobile = testInfo.project.name.startsWith('mobile');
    const closeEditor = async () => {
      if (isMobile) {
        await page.goBack();
      } else {
        await page.locator('app-exercise-page .editor-close').click();
      }
      await expect(page.locator('app-project-item-form')).not.toBeVisible();
    };

    await page.goto('/habits/h2');
    await page.locator('app-habit-hub-page mat-nav-list a', { hasText: text.hubTitle }).click();
    await expect(page).toHaveURL(/\/habits\/h2\/projects$/);
    await expect(page.locator('app-projects-summary')).toHaveCount(0);

    await page.locator('.add-button').click();
    await expect(page).toHaveURL(/\/habits\/h2\/projects\/new$/);
    const form = page.locator('app-project-item-form');
    await form.locator('.name-field').fill('Team offsite talk');
    await expect(page).toHaveURL(SAVED_URL);

    // The guard: steps stay locked, with a hint, until "What done looks like" has text.
    const newStep = form.locator('.new-step-field');
    await expect(newStep).toBeDisabled();
    await expect(form.locator('#project-steps-hint')).toHaveText(text.lockedHint);
    await form.locator('.result-field').fill('Twenty minutes, one idea, two questions at lunch.');
    await expect(newStep).toBeEnabled();
    await expect(form.locator('#project-steps-hint')).toHaveText('');

    await newStep.fill('Draft five slides.');
    await newStep.press('Enter');
    await expect(newStep).toHaveValue('');
    await newStep.fill('Write the one idea in a sentence.');
    await form.locator('.add-step').click();
    const stepFields = form.locator('.step-field');
    await expect(stepFields).toHaveCount(2);

    // Reorder with the buttons; focus stays on the button pressed.
    const secondUp = form.locator('.step-row').nth(1).locator('.move-up');
    await secondUp.click();
    await expect(stepFields.nth(0)).toHaveValue('Write the one idea in a sentence.');
    await expect(stepFields.nth(1)).toHaveValue('Draft five slides.');
    await expect(form.locator('.step-row').nth(0).locator('.move-up')).toBeFocused();

    await closeEditor();
    const row = page.locator('.exercise-list__item').first();
    await expect(row).toContainText('Team offsite talk');
    await expect(page.locator('app-projects-summary')).toBeVisible();

    // The hub's status. Longer than the 500 ms save debounce.
    await page.waitForTimeout(1000);
    await page.goto('/habits/h2');
    await expect(
      page
        .locator('app-habit-hub-page mat-nav-list a', { hasText: text.hubTitle })
        .locator('.hub-exercise-status'),
    ).toContainText(text.hubStatus);
    await page.goto(ROUTE);

    await page.locator('.exercise-list__item').first().click();
    const checks = form.getByRole('checkbox');
    await expect(checks).toHaveCount(2);
    await checks.nth(0).check();
    await expect(form.locator('.mark-project-done')).toHaveCount(0);
    await checks.nth(1).check();
    const markProjectDone = form.locator('.mark-project-done');
    await expect(markProjectDone).toHaveText(text.markProjectDone);
    await markProjectDone.click();
    await expect(markProjectDone).toHaveCount(0);
    await closeEditor();

    const finishedToggle = page.locator('#finished-toggle');
    await expect(finishedToggle).toContainText(text.finished);
    const markDoneButton = page.locator('app-done-toggle button', { hasText: text.markDone });
    await expect(markDoneButton).toBeEnabled();
    await markDoneButton.click();
    await expect(page.locator('app-done-toggle', { hasText: text.reopen })).toBeVisible();

    await page.waitForTimeout(1000);
    await page.reload();
    await expect(page.locator('#finished-toggle')).toBeVisible();
    await expect(page.locator('app-done-toggle', { hasText: text.reopen })).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical'),
    ).toEqual([]);
  });
});
