import AxeBuilder from '@axe-core/playwright';
import type { TestInfo } from '@playwright/test';
import { expect, test } from './fixtures';
import { t, type Locale } from './i18n';

/**
 * Your affirmations (issue #64). Happy path from the hub: write an affirmation, tick the five
 * qualities, add the scene, practise it (30 s, Done pressed early so the test doesn't wait), see
 * "Practised today", the summary and the hub status, mark done and reload. Escape and the header
 * Close mid-run log nothing. Playwright's clock skips the 5 s minimum instead of waiting it out.
 */

function localeFor(testInfo: TestInfo): Locale {
  return testInfo.project.name.endsWith('-ar') ? 'ar' : 'en';
}

function textFor(locale: Locale) {
  const own = (key: string) => t(locale, 'h2Affirmations', key);
  return {
    hubTitle: t(locale, 'habits', 'exercises.h2-affirmations.shortTitle'),
    hubStatus: t(
      locale,
      'habits',
      `exercises.h2-affirmations.practisedToday.${new Intl.PluralRules(locale).select(1)}`,
      { count: 1 },
    ),
    fourOfFive: own('list.checksText').replace('{{n}}', '4').replace('{{total}}', '5'),
    practisedToday: own('list.practisedTodayText'),
    thirtySeconds: own('length.30'),
    markDone: t(locale, 'exerciseKit', 'doneToggle.markDone'),
    reopen: t(locale, 'exerciseKit', 'doneToggle.reopen'),
  };
}

/** Copy from the app's own translation files (`e2e/i18n.ts`), never a literal (issue #228). */
const TEXT = { en: textFor('en'), ar: textFor('ar') };

const ROUTE = '/habits/h2/affirmations';
const SAVED_URL = /\/habits\/h2\/affirmations\/(?!new$)[^/]+$/;

test.describe('Your affirmations (h2-affirmations)', () => {
  test('writes, checks and practises an affirmation, marks done, and survives a reload', async ({
    page,
  }, testInfo) => {
    const text = TEXT[localeFor(testInfo)];
    const isMobile = testInfo.project.name.startsWith('mobile');
    // Real time keeps flowing; `fastForward()` only jumps past the 5 s minimum.
    await page.clock.install();

    await page.goto('/habits/h2');
    await page.locator('app-habit-hub-page mat-nav-list a', { hasText: text.hubTitle }).click();
    await expect(page).toHaveURL(/\/habits\/h2\/affirmations$/);
    await expect(page.locator('app-affirmations-summary')).toHaveCount(0);

    await page.locator('.add-button').click();
    await expect(page).toHaveURL(/\/habits\/h2\/affirmations\/new$/);
    const form = page.locator('app-affirmation-item-form');
    const [textField, sceneField] = [
      form.locator('textarea').first(),
      form.locator('textarea').nth(1),
    ];
    await textField.fill('When the door slams, I breathe out and ask what happened.');
    await expect(page).toHaveURL(SAVED_URL);
    const checks = form.getByRole('checkbox');
    await expect(checks).toHaveCount(5);
    for (let index = 0; index < 4; index++) {
      await checks.nth(index).check();
    }
    await sceneField.fill('The hallway after school.');

    if (isMobile) {
      await page.goBack();
    } else {
      await page.locator('app-exercise-page .editor-close').click();
    }
    await expect(form).not.toBeVisible();
    const row = page.locator('.exercise-list__item').first();
    await expect(row).toContainText(text.fourOfFive);
    await expect(page.locator('.exercise-list__action')).toHaveCount(0);

    await row.click();
    await checks.nth(4).check();
    if (isMobile) {
      await page.goBack();
    } else {
      await page.locator('app-exercise-page .editor-close').click();
    }
    await expect(form).not.toBeVisible();
    const practise = page.locator('.exercise-list__action');
    await expect(practise).toHaveCount(1);

    // Escape mid-run logs nothing, and focus comes back to the row's Practise button.
    await practise.click();
    const dialog = page.locator('app-affirmation-practice');
    await expect(dialog.locator('.practice-start')).toBeFocused();
    await dialog.locator('.practice-start').click();
    await expect(dialog.locator('.practice-done')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(practise).toBeFocused();
    await expect(row).not.toContainText(text.practisedToday);

    // The header's Close mid-run, past the minimum, logs nothing either.
    await practise.click();
    await dialog.locator('.practice-start').click();
    await page.clock.fastForward(10_000);
    await dialog.locator('.practice-close').click();
    await expect(dialog).toHaveCount(0);
    await expect(practise).toBeFocused();
    await expect(row).not.toContainText(text.practisedToday);

    // 30 s, Done pressed early (after the 5 s minimum; before it the dialog says to keep going).
    await practise.click();
    await dialog
      .locator('mat-button-toggle', { hasText: text.thirtySeconds })
      .locator('button')
      .click();
    await expect(dialog.locator('.practice-countdown')).toHaveText(/0:30|٠:٣٠/);
    const dialogScan = await new AxeBuilder({ page }).include('app-affirmation-practice').analyze();
    expect(
      dialogScan.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical'),
    ).toEqual([]);
    await dialog.locator('.practice-start').click();
    await expect(dialog.locator('.practice-too-short')).toBeVisible();
    await page.clock.fastForward(6_000);
    await expect(dialog.locator('.practice-too-short')).toHaveCount(0);
    await dialog.locator('.practice-done').click();
    await expect(dialog).toHaveCount(0);
    await expect(practise).toBeFocused();
    await expect(row).toContainText(text.practisedToday);
    await expect(page.locator('app-affirmations-summary')).toBeVisible();

    // The hub's status, before Mark done. Longer than the 500 ms save debounce.
    await page.waitForTimeout(1000);
    await page.goto('/habits/h2');
    await expect(
      page
        .locator('app-habit-hub-page mat-nav-list a', { hasText: text.hubTitle })
        .locator('.hub-exercise-status'),
    ).toContainText(text.hubStatus);
    await page.goto(ROUTE);

    const markDoneButton = page.locator('app-done-toggle button', { hasText: text.markDone });
    await expect(markDoneButton).toBeEnabled();
    await markDoneButton.click();
    await expect(page.locator('app-done-toggle', { hasText: text.reopen })).toBeVisible();

    await page.waitForTimeout(1000);
    await page.reload();
    await expect(page.locator('.exercise-list__item')).toHaveCount(1);
    await expect(page.locator('.exercise-list__item').first()).toContainText(text.practisedToday);
    await expect(page.locator('app-done-toggle', { hasText: text.reopen })).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical'),
    ).toEqual([]);
  });
});
