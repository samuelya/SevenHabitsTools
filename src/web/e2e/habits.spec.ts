import AxeBuilder from '@axe-core/playwright';
import { Locator } from '@playwright/test';
import { expect, test } from './fixtures';
import { t, type Locale } from './i18n';

/**
 * Habits list and habit hub (issues #31, #219), in both languages and at both viewport sizes
 * (`playwright.config.ts` projects): the list's three row states, the Paradigms hub's chapter
 * order and status column, "About this habit", and an empty hub. Fake-registry cases (ordering
 * fallbacks, every status kind) live in the component spec
 * (`src/app/features/habits/habits.spec.ts`).
 */

const HABIT_IDS = ['paradigms', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'h7', 'interdependence'];

/** Chapter order on the Paradigms hub (#219). */
const PARADIGMS_ORDER = [
  '/habits/paradigms/perception',
  '/habits/paradigms/transition',
  '/habits/paradigms/pc-balance',
  '/habits/paradigms/maturity',
  '/habits/paradigms/teach',
];

function textFor(locale: Locale) {
  const habits = (key: string, params?: Record<string, number>) => t(locale, 'habits', key, params);
  return {
    comingSoon: habits('hub.comingSoon'),
    later: habits('list.laterRange', { from: 4, to: 7 }),
    notStarted: habits('hub.notStarted'),
    onePattern: habits('exercises.paradigms-transition.patternCount.one'),
    aboutHabit: habits('hub.aboutHabit'),
    emptyState: habits('hub.noExercises'),
    teachThisChapter: habits('exercises.paradigms-teach.hubActionLabel'),
  };
}

/** Copy from the app's own translation files (`e2e/i18n.ts`), never a literal (issue #228). */
const TEXT = { en: textFor('en'), ar: textFor('ar') };

function localeFor(projectName: string): 'en' | 'ar' {
  return projectName.endsWith('-ar') ? 'ar' : 'en';
}

/** Nothing ends in an ellipsis: an element is truncated when its content is wider than its box
 * (same check as `titles.spec.ts`). */
async function expectNotTruncated(locator: Locator): Promise<void> {
  // `count()` doesn't wait: let the lazy route and its translations render first.
  await expect(locator.first()).toBeVisible();
  const count = await locator.count();
  for (let index = 0; index < count; index++) {
    const item = locator.nth(index);
    const { text, scrollWidth, clientWidth } = await item.evaluate((element) => ({
      text: element.textContent?.trim() ?? '',
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
    }));
    expect(scrollWidth, `"${text}" is truncated`).toBeLessThanOrEqual(clientWidth);
  }
}

test.describe('habits list and hub', () => {
  test('the habits list: Paradigms, Habit 1 and Habit 2 available, Habit 3 next up, the rest collapsed', async ({
    page,
  }, testInfo) => {
    const text = TEXT[localeFor(testInfo.project.name)];
    await page.goto('/habits');

    const links = page.locator('app-habits-page a');
    await expect(links).toHaveCount(4);
    await expect(links.nth(0)).toHaveAttribute('href', '/habits/paradigms');
    await expect(links.nth(1)).toHaveAttribute('href', '/habits/h1');
    await expect(links.nth(2)).toHaveAttribute('href', '/habits/h2');
    await expect(links.nth(3)).toHaveAttribute('href', '/habits/h3');
    await expect(links.nth(3).locator('.habit-coming-soon-chip')).toHaveText(text.comingSoon);

    const toggle = page.locator('app-habits-page .habit-later-toggle');
    await expect(toggle.locator('.habit-title')).toHaveText(text.later);
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expectNotTruncated(page.locator('app-habits-page .habit-row'));

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(links).toHaveCount(HABIT_IDS.length);
    for (const id of HABIT_IDS) {
      await expect(page.locator(`app-habits-page a[href="/habits/${id}"]`)).toBeVisible();
    }
    await expectNotTruncated(page.locator('app-habits-page .habit-row'));
  });

  test('the Paradigms hub lists its exercises in chapter order with a status column', async ({
    page,
    seedDocument,
  }, testInfo) => {
    const text = TEXT[localeFor(testInfo.project.name)];
    await seedDocument({
      habits: {
        paradigms: {
          scripts: [
            {
              id: '21111111-1111-4111-8111-111111111111',
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z',
              text: 'Conflict means someone has to lose',
              source: 'family',
              effect: 'harms',
              decision: 'rewrite',
            },
          ],
        },
      },
    });
    await page.goto('/habits/paradigms');

    const rows = page.locator('app-habit-hub-page mat-nav-list a');
    await expect(rows).toHaveCount(PARADIGMS_ORDER.length);
    for (const [index, href] of PARADIGMS_ORDER.entries()) {
      await expect(rows.nth(index)).toHaveAttribute('href', href);
      await expect(rows.nth(index).locator('.hub-number')).toHaveText(String(index + 1));
    }
    // The started transition exercise says how far it got; the others haven't been started.
    await expect(rows.nth(1).locator('.hub-row-status')).toHaveText(text.onePattern);
    for (const index of [0, 2, 3, 4]) {
      await expect(rows.nth(index).locator('.hub-row-status')).toHaveText(text.notStarted);
    }
    // The status is part of the row's accessible name (screen readers hear it with the title).
    await expect(rows.nth(1)).toHaveAccessibleName(new RegExp(text.onePattern));

    // Continue points at the first not-done exercise in chapter order.
    await expect(page.locator('app-habit-hub-page .hub-continue')).toHaveAttribute(
      'href',
      PARADIGMS_ORDER[0],
    );
    await expectNotTruncated(page.locator('app-habit-hub-page .hub-row'));
    await expectNotTruncated(page.locator('app-habit-hub-page .hub-continue'));

    // "Teach this chapter" comes last, after the list.
    const action = page.locator('app-habit-hub-page .hub-action');
    await expect(action).toHaveText(new RegExp(text.teachThisChapter));
    const actionBelowList = await page.evaluate(() => {
      const list = document.querySelector('app-habit-hub-page mat-nav-list');
      const button = document.querySelector('app-habit-hub-page .hub-action');
      return !!list && !!button && !!(list.compareDocumentPosition(button) & 4);
    });
    expect(actionBelowList).toBe(true);
  });

  test('About this habit shows In short and the exercises in order with their status', async ({
    page,
  }, testInfo) => {
    const text = TEXT[localeFor(testInfo.project.name)];
    await page.goto('/habits/paradigms');
    const hubTitles = page.locator('app-habit-hub-page .hub-exercise .hub-exercise-title');
    await expect(hubTitles).toHaveCount(PARADIGMS_ORDER.length);
    await expect(hubTitles.first()).not.toBeEmpty();

    const about = page.getByRole('button', { name: text.aboutHabit });
    await about.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { level: 2 })).toHaveText(text.aboutHabit);
    await expect(dialog.locator('p').first()).not.toBeEmpty();

    // #230: the same short titles and statuses as the hub rows, in the same order.
    const items = dialog.locator('.about-exercises > li');
    await expect(items).toHaveCount(PARADIGMS_ORDER.length);
    await expect(dialog.locator('.about-exercise .hub-exercise-title')).toHaveText(
      await hubTitles.allTextContents(),
    );
    await expect(items.first().locator('.hub-row-status')).toHaveText(text.notStarted);

    // Nothing spills sideways at 360 px or on desktop, in either direction.
    const overflow = await dialog
      .locator('.exercise-guide')
      .evaluate((element) => element.scrollWidth - element.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(about).toBeFocused();
  });

  test('a habit hub without exercises shows the empty state and Teach this chapter only', async ({
    page,
  }, testInfo) => {
    const text = TEXT[localeFor(testInfo.project.name)];
    await page.goto('/habits/h3');

    const hub = page.locator('app-habit-hub-page');
    await expect(hub.locator('h1')).toBeVisible();
    await expect(hub).toContainText(text.emptyState, { ignoreCase: true });
    await expect(hub.locator('.hub-continue')).toHaveCount(0);
    await expect(hub.locator('mat-nav-list')).toHaveCount(0);
    await expect(hub.locator('.hub-action')).toHaveCount(1);
  });

  test('every habit hub route resolves without an untranslated key', async ({ page }) => {
    for (const id of HABIT_IDS) {
      await page.goto(`/habits/${id}`);
      await expect(page.locator('app-habit-hub-page h1')).not.toHaveText(
        /^[a-z0-9]+(\.[a-z0-9]+)+$/i,
      );
    }
  });

  test('accessibility: the habits list and a habit hub have no serious or critical violations', async ({
    page,
  }) => {
    await page.goto('/habits');
    await expect(page.locator('app-habits-page .habit-later-toggle')).toBeVisible();
    let results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical'),
    ).toEqual([]);

    await page.goto('/habits/paradigms');
    // Labels come from lazily loaded translation scopes; scanning before they land reports a
    // transient nameless link or button (`link-name`), not the settled page.
    await expect(page.locator('app-habit-hub-page h1')).toBeVisible();
    await expect(page.locator('app-habit-hub-page .hub-row-status').first()).not.toBeEmpty();
    for (const action of await page.locator('.hub-action, .hub-about').all()) {
      await expect(action).not.toHaveAccessibleName('');
    }
    results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical'),
    ).toEqual([]);
  });
});
