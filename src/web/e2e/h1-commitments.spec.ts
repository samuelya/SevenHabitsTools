import AxeBuilder from '@axe-core/playwright';
import type { Page, TestInfo } from '@playwright/test';
import { expect, test } from './fixtures';
import { t, type Locale } from './i18n';

/**
 * Your promises (issue #57), the reference exercise for Habit 1. Happy path from the hub: add a
 * promise with a due date, keep it, see the rate, mark the exercise done, reload. Plus the shared
 * slice's eager registration: `shared.commitments` survives export -> wipe -> import with the
 * Promises page never opened.
 */

function localeFor(testInfo: TestInfo): Locale {
  return testInfo.project.name.endsWith('-ar') ? 'ar' : 'en';
}

function textFor(locale: Locale) {
  const own = (key: string) => t(locale, 'h1Commitments', key);
  return {
    hubTitle: t(locale, 'habits', 'exercises.h1-commitments.shortTitle'),
    oneOpen: t(locale, 'habits', 'exercises.h1-commitments.openCount.one'),
    markDone: t(locale, 'exerciseKit', 'doneToggle.markDone'),
    reopen: t(locale, 'exerciseKit', 'doneToggle.reopen'),
    checklistKept: own('checklist.kept'),
    keptButton: own('form.keptButton'),
    overdue: own('list.overdue'),
    fromLabel: own('filter.sourceLabel'),
    sourceLine: own('list.sourceText').replace(
      '{{exercise}}',
      t(locale, 'habits', 'exercises.paradigms-transition.shortTitle'),
    ),
    exportButton: t(locale, 'settings', 'backup.export'),
    importButton: t(locale, 'settings', 'backup.import'),
    replaceButton: t(locale, 'root', 'data.import.replace'),
    confirmReplaceButton: t(locale, 'root', 'data.import.confirmReplace'),
  };
}

/** Copy from the app's own translation files (`e2e/i18n.ts`), never a literal (issue #228). */
const TEXT = { en: textFor('en'), ar: textFor('ar') };

const ROUTE = '/habits/h1/commitments';
const SAVED_URL = /\/habits\/h1\/commitments\/(?!new$)[^/]+$/;

function localDate(offsetDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** `shared.commitments` as IndexedDB holds it; `null` while the slice doesn't exist. */
async function storedCommitments(page: Page): Promise<Record<string, unknown>[] | null> {
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
            resolve(get.result?.shared?.commitments ?? null);
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
  await expect(page.locator('app-commitments-item-form')).not.toBeVisible();
}

test.describe('Your promises (h1-commitments)', () => {
  test('backing out of an untouched draft leaves nothing', async ({ page }) => {
    await page.goto(ROUTE);
    await page.locator('.add-button').click();
    await expect(page).toHaveURL(/\/habits\/h1\/commitments\/new$/);
    const form = page.locator('app-commitments-item-form');
    await expect(form.locator('textarea').first()).toBeFocused();
    await page.goBack();
    await expect(form).not.toBeVisible();
    await expect(page.locator('.exercise-list__item')).toHaveCount(0);
    // Longer than the 500 ms save debounce.
    await page.waitForTimeout(1000);
    expect(await storedCommitments(page)).toBeNull();
  });

  test('adds a promise from the hub, keeps it, marks the exercise done, and it survives a reload', async ({
    page,
  }, testInfo) => {
    const text = TEXT[localeFor(testInfo)];
    const isMobile = testInfo.project.name.startsWith('mobile');
    const tomorrow = localDate(1);

    await page.goto('/habits/h1');
    await page.locator('app-habit-hub-page mat-nav-list a', { hasText: text.hubTitle }).click();
    await expect(page).toHaveURL(/\/habits\/h1\/commitments$/);
    // No zero counter: no summary card, only the gate checklist.
    await expect(page.locator('app-commitments-summary')).toHaveCount(0);
    await expect(page.locator('.done-checklist', { hasText: text.checklistKept })).toBeVisible();

    await page.locator('.add-button').click();
    const form = page.locator('app-commitments-item-form');
    await form.locator('textarea').first().fill('Call Mum on Sunday afternoon.');
    await expect(page).toHaveURL(SAVED_URL);
    // ISO is read in every locale (`parseLocalDate`); Tab commits it (Material's `dateChange`).
    await form.locator('.date-field input').fill(tomorrow);
    await form.locator('.date-field input').press('Tab');
    await expect(async () => {
      expect((await storedCommitments(page))?.[0]?.['dueDate']).toBe(tomorrow);
    }).toPass();

    await form.locator('button', { hasText: text.keptButton }).click();
    // The summary sits in the footer, which a handset hides while the full-screen editor is open.
    await closeEditor(page, isMobile);
    await expect(page.locator('app-commitments-summary')).toContainText('100');

    const markDoneButton = page.locator('app-done-toggle button', { hasText: text.markDone });
    await expect(markDoneButton).toBeEnabled();
    await markDoneButton.click();
    await expect(page.locator('app-done-toggle', { hasText: text.reopen })).toBeVisible();

    await page.waitForTimeout(1000);
    await page.reload();
    await expect(page.locator('.exercise-list__item')).toHaveCount(1);
    await expect(page.locator('app-done-toggle', { hasText: text.reopen })).toBeVisible();
    const stored = await storedCommitments(page);
    expect(stored?.[0]).toMatchObject({ status: 'kept', resolvedOn: localDate(0) });

    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical'),
    ).toEqual([]);

    await page.goto('/habits/h1');
    await expect(page.locator('app-habit-hub-page .hub-status')).toBeVisible();
  });

  test('shared.commitments survives export -> wipe -> import with the page never opened', async ({
    page,
    seedDocument,
  }, testInfo) => {
    const text = TEXT[localeFor(testInfo)];
    await seedDocument({
      shared: {
        commitments: [
          {
            id: '5b0c9c41-3a8e-4d53-9d2c-6d1f1c9e0a01',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
            text: 'Send the report to Dina by Friday.',
            toWhom: 'other',
            personName: 'Dina',
            dueDate: localDate(-2),
            status: 'open',
            source: { exerciseId: 'paradigms-transition' },
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
    expect(JSON.parse(exported.toString()).shared.commitments).toHaveLength(1);

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
      expect(await storedCommitments(page)).toHaveLength(1);
    }).toPass();

    await page.goto('/habits/h1');
    await expect(page.locator('app-habit-hub-page .hub-exercise-status')).toHaveText(text.oneOpen);

    await page.goto(ROUTE);
    const row = page.locator('.exercise-list__item');
    await expect(row).toHaveCount(1);
    await expect(row).toHaveClass(/exercise-list__item--warning/);
    await expect(row.locator('.visually-hidden')).toContainText(text.overdue);
    await expect(row).toContainText(text.sourceLine);
    await expect(page.getByText(text.fromLabel, { exact: true })).toBeVisible();

    await row.click();
    await expect(page.locator('app-commitments-item-form a.source-line')).toHaveAttribute(
      'href',
      '/habits/paradigms/transition',
    );
  });
});
