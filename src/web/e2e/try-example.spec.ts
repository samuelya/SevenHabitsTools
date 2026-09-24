import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { Locale, t } from './i18n';

/**
 * Issue #232: "Try this example" on a guide's card example copies it into a new item flagged as a
 * sample — an "Example" chip, counted toward nothing — until the user edits any field. List
 * exercises only (Transition, Teach); worksheets and assessments don't offer it. The Playwright
 * projects run it at 360/1280 in en/ar.
 */

interface Sample {
  readonly text?: string;
  readonly keyIdea?: string;
}

function samplesFor(folder: string, locale: Locale): readonly Sample[] {
  const file = join(__dirname, '..', 'src/app/features', folder, 'i18n', `${locale}.json`);
  const scope = JSON.parse(readFileSync(file, 'utf8')) as {
    guide: { examples: readonly { sample: Sample }[] };
  };
  return scope.guide.examples.map((example) => example.sample);
}

function localeFor(projectName: string): Locale {
  return projectName.endsWith('-ar') ? 'ar' : 'en';
}

async function openGuide(page: Page, lang: Locale) {
  await page
    .locator('app-exercise-prompt-card button', {
      hasText: t(lang, 'exerciseKit', 'promptCard.readMore'),
    })
    .click();
  const dialog = page.locator('mat-dialog-container');
  await expect(dialog).toBeVisible();
  return dialog;
}

async function closeEditor(page: Page): Promise<void> {
  await page.locator('app-exercise-page .editor-close').click();
  await expect(page.locator('.editor-panel')).not.toBeVisible();
}

test('transition: tries an example as a sample until the first edit', async ({
  page,
}, testInfo) => {
  const lang = localeFor(testInfo.project.name);
  const [sample] = samplesFor('paradigms-transition', lang);
  const exampleChip = t(lang, 'paradigmsTransition', 'list.example');

  await page.goto('/habits/paradigms/transition');
  const dialog = await openGuide(page, lang);
  const tryButton = dialog.locator('.try-example').first();
  await expect(tryButton).toContainText(t(lang, 'exerciseKit', 'guide.tryExample'));
  await tryButton.click();

  // The guide closes and the editor opens on a real, stored record, focus inside it (not back on
  // "Read more", which the dialog restored first).
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/habits\/paradigms\/transition\/[0-9a-f-]{36}$/);
  const text = page.locator('app-transition-item-form textarea').first();
  await expect(text).toHaveValue(sample.text as string);
  await expect(text).toBeFocused();

  // Survives a reload, still a sample (after the store's 500 ms save debounce, as
  // `paradigms-transition.spec.ts` waits too).
  await page.waitForTimeout(1000);
  await page.reload();
  await expect(text).toHaveValue(sample.text as string);
  await closeEditor(page);
  const row = page.locator('.exercise-list__item');
  await expect(row).toHaveCount(1);
  await expect(row.locator('.exercise-list__chip').first()).toHaveText(exampleChip);
  await expect(page.locator('app-transition-summary')).toHaveCount(0);

  // The first edit makes it the user's own.
  await row.click();
  await text.fill(`${sample.text} Mine now.`);
  await closeEditor(page);
  await expect(row.locator('.exercise-list__chip', { hasText: exampleChip })).toHaveCount(0);
  await expect(page.locator('app-transition-summary')).toBeVisible();
});

test('teach: tries an example into its chapter, then stops offering it', async ({
  page,
}, testInfo) => {
  const lang = localeFor(testInfo.project.name);
  const [sample] = samplesFor('paradigms-teach', lang);

  await page.goto('/habits/paradigms/teach');
  let dialog = await openGuide(page, lang);
  await dialog.locator('.try-example').first().click();

  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/habits\/paradigms\/teach\/paradigms$/);
  const keyIdea = page.locator('app-teach-item-form textarea').first();
  await expect(keyIdea).toHaveValue(sample.keyIdea as string);
  await closeEditor(page);

  const row = page.locator('.exercise-list__item', {
    hasText: t(lang, 'paradigmsTeach', 'chapter.paradigms'),
  });
  await expect(row.locator('.exercise-list__chip').first()).toHaveText(
    t(lang, 'paradigmsTeach', 'list.example'),
  );
  await expect(page.locator('app-teach-summary')).toHaveCount(0);

  // The chapter has an entry now: the guide no longer offers to overwrite it.
  dialog = await openGuide(page, lang);
  await expect(dialog.locator('.example-card--item').first()).toBeVisible();
  await expect(dialog.locator('.try-example')).toHaveCount(0);
});

for (const route of ['pc-balance', 'maturity']) {
  test(`${route}: a worksheet or assessment guide offers no "Try this example"`, async ({
    page,
  }, testInfo) => {
    const lang = localeFor(testInfo.project.name);

    await page.goto(`/habits/paradigms/${route}`);
    const dialog = await openGuide(page, lang);

    await expect(dialog.locator('.example-card').first()).toBeVisible();
    await expect(dialog.locator('.try-example')).toHaveCount(0);
  });
}
