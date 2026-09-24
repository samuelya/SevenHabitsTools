import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from './fixtures';
import { Locale, Scope, t } from './i18n';

/**
 * Issue #231: "Read more" on the four list/assessment Paradigms exercises opens the guide with its
 * four sections and the BA's card examples, nothing in the dialog overflows sideways, and closing
 * returns focus to the button. The Playwright projects run it at 360/1280 in en/ar.
 */

const EXERCISES: readonly { route: string; scope: Scope; folder: string }[] = [
  { route: 'transition', scope: 'paradigmsTransition', folder: 'paradigms-transition' },
  { route: 'pc-balance', scope: 'paradigmsPcBalance', folder: 'paradigms-pc-balance' },
  { route: 'maturity', scope: 'paradigmsMaturity', folder: 'paradigms-maturity' },
  { route: 'teach', scope: 'paradigmsTeach', folder: 'paradigms-teach' },
];

interface Guide {
  readonly examples: readonly { readonly title: string; readonly done?: boolean }[];
}

function guideFor(folder: string, locale: Locale): Guide {
  const file = join(__dirname, '..', 'src/app/features', folder, 'i18n', `${locale}.json`);
  return (JSON.parse(readFileSync(file, 'utf8')) as { guide: Guide }).guide;
}

function localeFor(projectName: string): Locale {
  return projectName.endsWith('-ar') ? 'ar' : 'en';
}

for (const exercise of EXERCISES) {
  test(`${exercise.route}: "Read more" shows the guide with its card examples`, async ({
    page,
  }, testInfo) => {
    const lang = localeFor(testInfo.project.name);
    const guide = guideFor(exercise.folder, lang);

    await page.goto(`/habits/paradigms/${exercise.route}`);
    const readMore = page.locator('app-exercise-prompt-card button', {
      hasText: t(lang, 'exerciseKit', 'promptCard.readMore'),
    });
    await readMore.click();

    const dialog = page.locator('mat-dialog-container');
    await expect(dialog.locator('h2')).toHaveText(t(lang, 'exerciseKit', 'guide.title'));
    for (const heading of ['inShort', 'howTo', 'example', 'afterwards']) {
      await expect(
        dialog.locator('h3', { hasText: t(lang, 'exerciseKit', `guide.${heading}`) }),
      ).toBeVisible();
    }

    const cards = dialog.locator('.example-card--item');
    await expect(cards).toHaveCount(guide.examples.length);
    for (const [index, example] of guide.examples.entries()) {
      const card = cards.nth(index);
      await expect(card.locator('.example-item-title')).toHaveText(example.title);
      await expect(card.locator('.example-item-icon mat-icon')).toHaveCount(example.done ? 1 : 0);
    }

    // Nothing wider than the dialog: every example wraps instead of scrolling sideways.
    const overflow = await dialog
      .locator('.exercise-guide')
      .evaluate((element) => element.scrollWidth - element.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    await dialog.getByRole('button', { name: t(lang, 'exerciseKit', 'guide.close') }).click();
    await expect(dialog).toBeHidden();
    await expect(readMore).toBeFocused();
  });
}
