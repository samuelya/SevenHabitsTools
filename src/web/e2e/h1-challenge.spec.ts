import AxeBuilder from '@axe-core/playwright';
import type { Page, TestInfo } from '@playwright/test';
import { expect, test } from './fixtures';
import { t, type Locale } from './i18n';

/**
 * The 30-day test (issue #56), a tracker on the Habit 1 hub. The happy path is seeded on day 30
 * (`seedDocument`, playbook §7): open it from the hub, check in, write the final note, finish,
 * mark done, reload. Plus the day strip's keyboard model (one tab stop, arrows follow the text
 * direction) and the start form on a first visit.
 */

function localeFor(testInfo: TestInfo): Locale {
  return testInfo.project.name.endsWith('-ar') ? 'ar' : 'en';
}

function textFor(locale: Locale) {
  const own = (key: string, params: Record<string, string | number> = {}) =>
    t(locale, 'h1Challenge', key, params);
  return {
    hubTitle: t(locale, 'habits', 'exercises.h1-challenge.shortTitle'),
    markDone: t(locale, 'exerciseKit', 'doneToggle.markDone'),
    reopen: t(locale, 'exerciseKit', 'doneToggle.reopen'),
    day30: own('day.title', { day: 30 }),
    day1: own('day.title', { day: 1 }),
    startButton: own('start.startButton'),
    saveButton: own('checkin.saveButton'),
    savedText: own('checkin.savedText'),
    finishButton: own('final.finishButton'),
    finalLabel: own('final.noteLabel'),
    startLegend: own('start.legend'),
    pastLegend: own('past.legend'),
    completed: own('status.completed'),
  };
}

/** Copy from the app's own translation files (`e2e/i18n.ts`), never a literal (issue #228). */
const TEXT = { en: textFor('en'), ar: textFor('ar') };

const ROUTE = '/habits/h1/challenge';

function localDate(offsetDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function habits(challenges: unknown[]) {
  return {
    paradigms: {},
    h1: { challenges },
    h2: {},
    h3: {},
    h4: {},
    h5: {},
    h6: {},
    h7: {},
    interdependence: {},
  };
}

/** A running test whose day 30 is today, checked in on days 27-29. */
function testOnDay30() {
  return {
    id: '7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    startDate: localDate(-29),
    status: 'active',
    checkins: [-3, -2, -1].map((offset) => ({
      date: localDate(offset),
      answers: { influence: true, promise: true, response: true, noBlame: true },
    })),
  };
}

/** `habits.h1.challenges` as IndexedDB holds it. */
async function storedChallenges(page: Page): Promise<Record<string, unknown>[] | null> {
  return page.evaluate(
    () =>
      new Promise<Record<string, unknown>[] | null>((resolve, reject) => {
        const open = indexedDB.open('sevenhabits');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const get = open.result.transaction('documents').objectStore('documents').get('current');
          get.onsuccess = () => {
            open.result.close();
            resolve(get.result?.habits?.h1?.challenges ?? null);
          };
          get.onerror = () => reject(get.error);
        };
      }),
  );
}

test.describe('30-day test (h1-challenge)', () => {
  test('a first visit shows the start form; "Start test" begins day 1', async ({
    page,
  }, testInfo) => {
    const text = TEXT[localeFor(testInfo)];
    await page.goto(ROUTE);
    await expect(page.locator('app-challenge-start-form')).toContainText(text.startLegend);
    await page.getByRole('button', { name: text.startButton }).click();
    await expect(page.locator('.day-title')).toHaveText(text.day1);
    await expect(page.locator('.strip .cell')).toHaveCount(30);
    await expect(async () => {
      expect((await storedChallenges(page))?.[0]).toMatchObject({
        startDate: localDate(0),
        status: 'active',
      });
    }).toPass();
  });

  test('on day 30: check in, write the final note, finish, mark done, and it survives a reload', async ({
    page,
    seedDocument,
  }, testInfo) => {
    const text = TEXT[localeFor(testInfo)];
    await seedDocument({ habits: habits([testOnDay30()]) });

    await page.goto('/habits/h1');
    await page.locator('app-habit-hub-page mat-nav-list a', { hasText: text.hubTitle }).click();
    await expect(page).toHaveURL(/\/habits\/h1\/challenge$/);
    await expect(page.locator('.day-title')).toHaveText(text.day30);

    const form = page.locator('app-challenge-checkin-form');
    await form.locator('mat-slide-toggle button').first().click();
    await page.getByRole('button', { name: text.saveButton }).click();
    await expect(form.locator('.saved-line')).toHaveText(text.savedText);

    const finish = page.getByRole('button', { name: text.finishButton });
    await expect(finish).toHaveAttribute('aria-disabled', 'true');
    await page
      .getByRole('textbox', { name: text.finalLabel })
      .fill('Fewer arguments about things I cannot change.');
    // `ReflectionEditor` saves after a 1 s debounce; Finish turns on once the note is stored.
    await expect(finish).not.toHaveAttribute('aria-disabled', 'true');
    await finish.click();

    await expect(page.locator('app-challenge-start-form')).toBeVisible();
    await expect(page.locator('.past-row')).toContainText(text.completed);
    const markDoneButton = page.locator('app-done-toggle button', { hasText: text.markDone });
    await expect(markDoneButton).not.toHaveAttribute('aria-disabled', 'true');
    await markDoneButton.click();
    await expect(page.locator('app-done-toggle', { hasText: text.reopen })).toBeVisible();

    await page.waitForTimeout(1000);
    await page.reload();
    await expect(page.locator('app-done-toggle', { hasText: text.reopen })).toBeVisible();
    const stored = await storedChallenges(page);
    expect(stored?.[0]).toMatchObject({ status: 'completed', endedOn: localDate(0) });
    expect((stored?.[0]?.['checkins'] as unknown[]).length).toBe(4);

    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical'),
    ).toEqual([]);
  });

  test('the day strip is one tab stop on today, and the arrows follow the text direction', async ({
    page,
    seedDocument,
  }, testInfo) => {
    await seedDocument({ habits: habits([testOnDay30()]) });
    await page.goto(ROUTE);
    const cells = page.locator('.strip .cell');
    await expect(cells).toHaveCount(30);
    await expect(page.locator('.strip [tabindex="0"]')).toHaveCount(1);
    await expect(cells.nth(29)).toHaveAttribute('tabindex', '0');

    await cells.nth(29).focus();
    await page.keyboard.press(localeFor(testInfo) === 'ar' ? 'ArrowRight' : 'ArrowLeft');
    await expect(cells.nth(28)).toBeFocused();
    await page.keyboard.press('Home');
    await expect(cells.nth(0)).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(cells.nth(0)).toBeFocused();

    const results = await new AxeBuilder({ page }).include('app-challenge-day-strip').analyze();
    expect(
      results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical'),
    ).toEqual([]);
  });
});
