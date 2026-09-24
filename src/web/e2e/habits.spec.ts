import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

/**
 * Habit hub flow (issue #31): the overview lists every habit, Home links to it, and each habit's
 * own hub page renders — today, with no exercise registered yet, that means every hub shows the
 * "coming soon" empty state rather than a listing, in both languages and at both viewport sizes
 * (`playwright.config.ts` projects). The listing/Continue/done-badge behaviour itself is covered
 * by the component spec (`src/app/features/habits/habits.spec.ts`), which can register a fake
 * exercise the way this suite — against the real production bundle — cannot.
 */

const HABIT_IDS = ['paradigms', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'h7', 'interdependence'];

function localeFor(projectName: string): 'en' | 'ar' {
  return projectName.endsWith('-ar') ? 'ar' : 'en';
}

test.describe('habit hub', () => {
  test('Home links to the habit overview, which lists every habit', async ({ page }, testInfo) => {
    await page.goto('/');
    const browseHabits =
      localeFor(testInfo.project.name) === 'ar' ? 'تصفح العادات' : 'Browse habits';
    await page.getByRole('link', { name: browseHabits }).click();

    await expect(page).toHaveURL(/\/habits$/);
    const links = page.locator('app-habits-page a');
    await expect(links).toHaveCount(HABIT_IDS.length);
    for (const id of HABIT_IDS) {
      await expect(page.locator(`app-habits-page a[href="/habits/${id}"]`)).toBeVisible();
    }
  });

  test('a habit hub shows its intro and the empty state when nothing is registered yet', async ({
    page,
  }, testInfo) => {
    await page.goto('/habits/h1');

    const hub = page.locator('app-habit-hub-page');
    await expect(hub.locator('h1')).toBeVisible();
    await expect(hub.locator('.hub-intro')).not.toBeEmpty();
    const expectedEmptyState =
      localeFor(testInfo.project.name) === 'ar' ? 'ستتوفر قريبًا' : 'coming soon';
    await expect(hub).toContainText(expectedEmptyState, { ignoreCase: true });
    await expect(hub.locator('.hub-continue')).toHaveCount(0);
  });

  test('every habit hub route resolves without an untranslated key', async ({ page }) => {
    for (const id of HABIT_IDS) {
      await page.goto(`/habits/${id}`);
      await expect(page.locator('app-habit-hub-page h1')).not.toHaveText(
        /^[a-z0-9]+(\.[a-z0-9]+)+$/i,
      );
      await expect(page.locator('app-habit-hub-page .hub-intro')).not.toHaveText(
        /^[a-z0-9]+(\.[a-z0-9]+)+$/i,
      );
    }
  });

  test('accessibility: the habit overview and a habit hub have no serious or critical violations', async ({
    page,
  }) => {
    await page.goto('/habits');
    let results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical'),
    ).toEqual([]);

    await page.goto('/habits/h1');
    // A hub action's label comes from a lazily loaded translation scope; scanning before it lands
    // reports a transient nameless link (`link-name`), not the settled page (flaky on main too).
    await expect(page.locator('app-habit-hub-page h1')).toBeVisible();
    for (const action of await page.locator('.hub-action').all()) {
      await expect(action).not.toHaveAccessibleName('');
    }
    results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical'),
    ).toEqual([]);
  });
});
