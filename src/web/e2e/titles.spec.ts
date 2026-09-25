import { Locator } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * Short titles (issue #218): every piece of chrome that names a habit or an exercise — the top
 * app bar, the habits list, a hub's exercise list and its "Continue" button — must fit without
 * an ellipsis, at 360 px and on desktop, in `en` and `ar` (the four Playwright projects). An
 * element is truncated when its content is wider than its box (`text-overflow: ellipsis` only
 * shows then), so each check compares `scrollWidth` with `clientWidth`.
 */

const HABIT_IDS = ['paradigms', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'h7', 'interdependence'];

const EXERCISE_ROUTES = [
  '/habits/paradigms/perception',
  '/habits/paradigms/transition',
  '/habits/paradigms/pc-balance',
  '/habits/paradigms/maturity',
  '/habits/paradigms/teach',
  '/habits/h1/rehearsal',
  '/habits/h1/circle',
  '/habits/h1/commitments',
  '/habits/h1/challenge',
];

async function expectNotTruncated(locator: Locator): Promise<void> {
  // `count()` doesn't wait: let the lazy route and its translations render first.
  await expect(locator.first()).toBeVisible();
  const count = await locator.count();
  for (let index = 0; index < count; index++) {
    const item = locator.nth(index);
    await expect(item).toBeVisible();
    const { text, scrollWidth, clientWidth } = await item.evaluate((element) => {
      // An inline title (Material's list title) has no box of its own to overflow: the block
      // around it is what clips the text, so measure that one.
      let box: Element = element;
      while (box.parentElement && getComputedStyle(box).display === 'inline') {
        box = box.parentElement;
      }
      return {
        text: element.textContent?.trim() ?? '',
        scrollWidth: box.scrollWidth,
        clientWidth: box.clientWidth,
      };
    });
    expect(scrollWidth, `"${text}" is truncated`).toBeLessThanOrEqual(clientWidth);
  }
}

test.describe('short titles fit without truncation (#218)', () => {
  test('the habits list and every habit hub title', async ({ page }) => {
    await page.goto('/habits');
    await expectNotTruncated(page.locator('app-habits-page [matListItemTitle]'));

    for (const habit of HABIT_IDS) {
      await page.goto(`/habits/${habit}`);
      await expect(page.locator('app-habit-hub-page h1')).toBeVisible();
      await expectNotTruncated(page.getByTestId('page-title'));
    }
  });

  test("the Paradigms hub's exercise list and Continue button", async ({ page }) => {
    await page.goto('/habits/paradigms');
    await expectNotTruncated(page.locator('app-habit-hub-page mat-nav-list [matListItemTitle]'));
    await expectNotTruncated(page.locator('app-habit-hub-page .hub-continue'));
  });

  test('every exercise title in the app bar, with the long title kept in the h1 and intro card', async ({
    page,
  }) => {
    for (const route of EXERCISE_ROUTES) {
      await page.goto(route);
      await expectNotTruncated(page.getByTestId('page-title'));

      // `textContent()` doesn't wait either: wait until the h1 holds its translated title.
      const heading = page.locator('app-exercise-page h1');
      await expect(heading).not.toBeEmpty();
      const short = (await page.getByTestId('page-title').textContent())?.trim() ?? '';
      const long = (await heading.textContent())?.trim() ?? '';
      // The h1 is visually hidden; the intro card shows the same long title to sighted users
      // while it is expanded (a phone, or a later visit, opens it collapsed).
      const toggle = page.locator('app-exercise-prompt-card .toggle');
      await expect(toggle).toBeVisible();
      if ((await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click();
      const visibleLong = page.locator('app-exercise-prompt-card .prompt-heading');
      await expect(visibleLong).toBeVisible();
      await expect(visibleLong).toHaveText(long);
      expect(await page.title()).toContain(short);
    }
  });
});
