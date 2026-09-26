import AxeBuilder from '@axe-core/playwright';
import type { Page, TestInfo } from '@playwright/test';
import { expect, test } from './fixtures';
import { t, type Locale } from './i18n';

/**
 * Your collection (issue #63). Happy path from the hub: add three items, one with a source and a
 * tag typed into the chip grid, star one from its row, filter by kind and by tag, check the hub's
 * status text, mark the exercise done and reload.
 */

function localeFor(testInfo: TestInfo): Locale {
  return testInfo.project.name.endsWith('-ar') ? 'ar' : 'en';
}

function textFor(locale: Locale) {
  const own = (key: string) => t(locale, 'h2Inspiration', key);
  return {
    hubTitle: t(locale, 'habits', 'exercises.h2-inspiration.shortTitle'),
    hubStatus: t(
      locale,
      'habits',
      `exercises.h2-inspiration.collectedCount.${new Intl.PluralRules(locale).select(3)}`,
      { count: 3 },
    ),
    saying: own('kind.saying'),
    thought: own('kind.thought'),
    favourite: own('list.favouriteButton'),
    checklistTag: own('checklist.tag'),
    markDone: t(locale, 'exerciseKit', 'doneToggle.markDone'),
    reopen: t(locale, 'exerciseKit', 'doneToggle.reopen'),
  };
}

/** Copy from the app's own translation files (`e2e/i18n.ts`), never a literal (issue #228). */
const TEXT = { en: textFor('en'), ar: textFor('ar') };

const ROUTE = '/habits/h2/inspiration';
const SAVED_URL = /\/habits\/h2\/inspiration\/(?!new$)[^/]+$/;

async function closeEditor(page: Page, isMobile: boolean): Promise<void> {
  if (isMobile) {
    await page.goBack();
  } else {
    await page.locator('app-exercise-page .editor-close').click();
  }
  await expect(page.locator('app-inspiration-item-form')).not.toBeVisible();
}

/** Adds an item with `line`, and optionally a kind, a source and a tag, then closes the editor. */
async function addItem(
  page: Page,
  isMobile: boolean,
  line: string,
  options: { kind?: string; source?: string; tag?: string } = {},
): Promise<void> {
  await page.locator('.add-button').click();
  await expect(page).toHaveURL(/\/habits\/h2\/inspiration\/new$/);
  const form = page.locator('app-inspiration-item-form');
  await form.locator('textarea').fill(line);
  await expect(page).toHaveURL(SAVED_URL);
  if (options.kind) {
    const toggle = form.locator('mat-button-toggle', { hasText: options.kind });
    await toggle.locator('button').click();
    await expect(toggle).toHaveClass(/mat-button-toggle-checked/);
  }
  if (options.source) {
    await form.locator('input[type="text"]').fill(options.source);
  }
  if (options.tag) {
    const tagInput = form.locator('.tag-input');
    await tagInput.fill(options.tag);
    await tagInput.press('Enter');
    await expect(form.locator('mat-chip-row')).toHaveText([options.tag]);
    await expect(tagInput).toHaveValue('');
  }
  await closeEditor(page, isMobile);
}

test.describe('Your collection (h2-inspiration)', () => {
  test('collects items from the hub, stars and filters them, marks done, and survives a reload', async ({
    page,
  }, testInfo) => {
    const text = TEXT[localeFor(testInfo)];
    const isMobile = testInfo.project.name.startsWith('mobile');

    await page.goto('/habits/h2');
    await page.locator('app-habit-hub-page mat-nav-list a', { hasText: text.hubTitle }).click();
    await expect(page).toHaveURL(/\/habits\/h2\/inspiration$/);
    await expect(page.locator('app-inspiration-summary')).toHaveCount(0);
    await expect(page.locator('.done-checklist', { hasText: text.checklistTag })).toBeVisible();

    await addItem(page, isMobile, 'Say the second thing.', { source: 'My uncle', tag: 'family' });
    await addItem(page, isMobile, 'Leave before you are tired.', { kind: text.thought });
    await addItem(page, isMobile, 'Walk to work once a week.');
    const rows = page.locator('.exercise-list__item');
    await expect(rows).toHaveCount(3);
    await expect(page.locator('app-inspiration-summary')).toBeVisible();

    // The row's star: a pressed toggle, named the same in both states.
    const stars = page.locator('.exercise-list__toggle');
    await expect(stars).toHaveCount(3);
    await stars.first().click();
    await expect(stars.first()).toHaveAttribute('aria-pressed', 'true');
    await expect(stars.first()).toHaveAttribute('aria-label', text.favourite);

    // Kind chips, then the tag chips (shown once a tag exists).
    const kindFilter = page.locator('app-inspiration-filters mat-chip-listbox').first();
    await kindFilter.getByRole('option', { name: text.thought }).click();
    await expect(rows).toHaveCount(1);
    await expect(rows.first().locator('.exercise-list__chip')).toHaveText([text.thought]);
    await kindFilter.getByRole('option', { name: text.thought }).click();
    await expect(rows).toHaveCount(3);
    const tagFilter = page.locator('.tag-filter');
    await expect(tagFilter.getByRole('option')).toHaveText(['family']);
    await tagFilter.getByRole('option', { name: 'family' }).click();
    await expect(rows).toHaveCount(1);
    await tagFilter.getByRole('option', { name: 'family' }).click();
    await expect(rows).toHaveCount(3);

    // The hub's status, before Mark done (a done exercise shows its date instead). Longer than
    // the 500 ms save debounce, since `goto` reloads the app.
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
    await expect(page.locator('.exercise-list__item')).toHaveCount(3);
    await expect(page.locator('.exercise-list__toggle[aria-pressed="true"]')).toHaveCount(1);
    await expect(page.locator('app-done-toggle', { hasText: text.reopen })).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical'),
    ).toEqual([]);
  });
});
