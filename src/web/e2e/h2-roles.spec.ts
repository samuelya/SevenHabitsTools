import AxeBuilder from '@axe-core/playwright';
import type { Page, TestInfo } from '@playwright/test';
import { expect, test } from './fixtures';
import { t, type Locale } from './i18n';

/**
 * Your roles (issue #59), the reference exercise for Habit 2. Happy path from the hub: add two
 * roles, rate them and the built-in Sharpen the Saw, write a picture note, mark the exercise done,
 * reload. Plus the shared slice's eager registration: `shared.roles` survives export -> wipe ->
 * import with the Roles page never opened.
 */

function localeFor(testInfo: TestInfo): Locale {
  return testInfo.project.name.endsWith('-ar') ? 'ar' : 'en';
}

function textFor(locale: Locale) {
  const own = (key: string) => t(locale, 'h2Roles', key);
  const roleCount = (count: number) =>
    t(
      locale,
      'habits',
      `exercises.h2-roles.roleCount.${new Intl.PluralRules(locale).select(count)}`,
      { count },
    );
  return {
    hubTitle: t(locale, 'habits', 'exercises.h2-roles.shortTitle'),
    twoRoles: roleCount(2),
    renewal: t(locale, 'exerciseKit', 'roles.renewal'),
    builtIn: own('list.builtIn'),
    markDone: t(locale, 'exerciseKit', 'doneToggle.markDone'),
    reopen: t(locale, 'exerciseKit', 'doneToggle.reopen'),
    checklistRated: own('checklist.rated'),
    exportButton: t(locale, 'settings', 'backup.export'),
    importButton: t(locale, 'settings', 'backup.import'),
    replaceButton: t(locale, 'root', 'data.import.replace'),
    confirmReplaceButton: t(locale, 'root', 'data.import.confirmReplace'),
  };
}

/** Copy from the app's own translation files (`e2e/i18n.ts`), never a literal (issue #228). */
const TEXT = { en: textFor('en'), ar: textFor('ar') };

const ROUTE = '/habits/h2/roles';
const SAVED_URL = /\/habits\/h2\/roles\/(?!new$)[^/]+$/;

/** `shared.roles` as IndexedDB holds it; `null` while the slice doesn't exist. */
async function storedRoles(page: Page): Promise<Record<string, unknown>[] | null> {
  return page.evaluate(
    () =>
      new Promise<Record<string, unknown>[] | null>((resolve, reject) => {
        const open = indexedDB.open('sevenhabits');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains('documents')) {
            db.close();
            resolve(null);
            return;
          }
          const get = db.transaction('documents').objectStore('documents').get('current');
          get.onsuccess = () => {
            db.close();
            resolve(get.result?.shared?.roles ?? null);
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
  await expect(page.locator('app-roles-item-form')).not.toBeVisible();
}

/** Adds a role named `name` rated `rating`, with `note` if given, and closes the editor. */
async function addRole(
  page: Page,
  isMobile: boolean,
  name: string,
  rating: number,
  note?: string,
): Promise<void> {
  await page.locator('.add-button').click();
  const form = page.locator('app-roles-item-form');
  await form.locator('input[type="text"]').first().fill(name);
  await expect(page).toHaveURL(SAVED_URL);
  await form.getByRole('radio', { name: String(rating), exact: true }).check();
  if (note) {
    await form.locator('textarea').fill(note);
  }
  await closeEditor(page, isMobile);
}

test.describe('Your roles (h2-roles)', () => {
  test('backing out of an untouched draft leaves nothing', async ({ page }) => {
    await page.goto(ROUTE);
    await page.locator('.add-button').click();
    await expect(page).toHaveURL(/\/habits\/h2\/roles\/new$/);
    const form = page.locator('app-roles-item-form');
    await expect(form.locator('input[type="text"]').first()).toBeFocused();
    await page.goBack();
    await expect(form).not.toBeVisible();
    await expect(page.locator('.exercise-list__item')).toHaveCount(0);
    // Longer than the 500 ms save debounce.
    await page.waitForTimeout(1000);
    expect(await storedRoles(page)).toBeNull();
  });

  test('adds roles from the hub, rates them, marks the exercise done, and it survives a reload', async ({
    page,
  }, testInfo) => {
    const text = TEXT[localeFor(testInfo)];
    const isMobile = testInfo.project.name.startsWith('mobile');

    await page.goto('/habits/h2');
    await page.locator('app-habit-hub-page mat-nav-list a', { hasText: text.hubTitle }).click();
    await expect(page).toHaveURL(/\/habits\/h2\/roles$/);
    // No zero counter: no summary card, only the gate checklist.
    await expect(page.locator('app-roles-summary')).toHaveCount(0);
    await expect(page.locator('.done-checklist', { hasText: text.checklistRated })).toBeVisible();

    await addRole(page, isMobile, 'Dad', 3, "Not yet. I'm there for homework, not for fun.");
    await addRole(page, isMobile, 'Friend', 4);
    // The first role brought the built-in with it, locked and first in the list.
    const rows = page.locator('.exercise-list__item');
    await expect(rows).toHaveCount(3);
    await expect(rows.first()).toContainText(text.renewal);
    await expect(rows.first().locator('.visually-hidden')).toContainText(text.builtIn);

    await rows.first().click();
    await page
      .locator('app-roles-item-form')
      .getByRole('radio', { name: '2', exact: true })
      .check();
    await closeEditor(page, isMobile);
    await expect(page.locator('app-roles-summary')).toBeVisible();

    const markDoneButton = page.locator('app-done-toggle button', { hasText: text.markDone });
    await expect(markDoneButton).toBeEnabled();
    await markDoneButton.click();
    await expect(page.locator('app-done-toggle', { hasText: text.reopen })).toBeVisible();

    await page.waitForTimeout(1000);
    await page.reload();
    await expect(page.locator('.exercise-list__item')).toHaveCount(3);
    await expect(page.locator('app-done-toggle', { hasText: text.reopen })).toBeVisible();
    const stored = await storedRoles(page);
    expect(stored?.map((role) => role['satisfaction']).sort()).toEqual([2, 3, 4]);

    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical'),
    ).toEqual([]);

    await page.goto('/habits/h2');
    await expect(page.locator('app-habit-hub-page .hub-status')).toBeVisible();
  });

  test('shared.roles survives export -> wipe -> import with the page never opened', async ({
    page,
    seedDocument,
  }, testInfo) => {
    const text = TEXT[localeFor(testInfo)];
    await seedDocument({
      shared: {
        roles: [
          {
            id: '7c1e2f3a-4b5c-4d6e-8f70-81a2b3c4d5e6',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
            key: 'renewal',
            order: 0,
          },
          {
            id: '7c1e2f3a-4b5c-4d6e-8f70-81a2b3c4d5e7',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
            name: 'Dad',
            color: 'blue',
            order: 1,
            satisfaction: 3,
          },
        ],
      },
    });
    await page.goto('/settings');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: text.exportButton }).click(),
    ]);
    const chunks: Buffer[] = [];
    for await (const chunk of await download.createReadStream()) {
      chunks.push(chunk as Buffer);
    }
    const exported = Buffer.concat(chunks);
    expect(JSON.parse(exported.toString()).shared.roles).toHaveLength(2);

    await page.evaluate(() => indexedDB.deleteDatabase('sevenhabits'));
    await page.reload();
    await page.getByRole('button', { name: text.importButton }).waitFor();
    await page.setInputFiles('input[type="file"]', {
      name: 'sevenhabits-export.json',
      mimeType: 'application/json',
      buffer: exported,
    });
    await page.getByRole('button', { name: text.replaceButton }).click();
    await page.getByRole('button', { name: text.confirmReplaceButton }).click();
    await expect(async () => {
      expect(await storedRoles(page)).toHaveLength(2);
    }).toPass();

    await page.goto('/habits/h2');
    await expect(page.locator('app-habit-hub-page .hub-exercise-status')).toHaveText(text.twoRoles);

    await page.goto(ROUTE);
    const rows = page.locator('.exercise-list__item');
    await expect(rows).toHaveCount(2);
    await expect(rows.first()).toContainText(text.renewal);
    await expect(rows.nth(1)).toContainText('Dad');
    await expect(rows.nth(1).locator('.exercise-list__swatch')).toBeVisible();
  });
});
