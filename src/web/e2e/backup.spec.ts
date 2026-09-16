import type { Page, TestInfo } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * Exercises JSON export/import end to end (issue #37): export downloads a file, a full
 * export → wipe → import round trip restores the document (architecture issue #1 §9's reload/
 * round-trip bar), an invalid file is rejected without touching the current document, and a
 * read-only tab refuses to import.
 */

const FILE_INPUT = 'input[type="file"]';

/** None of these tests seed a language, so they render whichever language the project's own
 * locale defaults to (`mobile-ar`/`desktop-ar`, per `playwright.config.ts`) — the strings below
 * let assertions target the right one instead of hardcoding `en`. */
const BACKUP_TEXT = {
  en: {
    appName: 'Seven Habits Tools',
    exportButton: 'Export data',
    importButton: 'Import data',
    replaceButton: 'Replace…',
    confirmReplaceButton: 'Yes, replace',
    errorHeading: "We couldn't read your saved data",
    notJson: /JSON file this app can read/i,
    invalid: /data isn't in a shape/i,
    readOnlyImportRefused: /read-only, so it can't import/i,
    alreadyRecovered: 'Another tab has already recovered your data',
  },
  ar: {
    appName: 'أدوات العادات السبع',
    exportButton: 'تصدير البيانات',
    importButton: 'استيراد البيانات',
    replaceButton: 'استبدال…',
    confirmReplaceButton: 'نعم، استبدال',
    errorHeading: 'تعذّرت قراءة بياناتك المحفوظة',
    notJson: /ملف JSON يمكن لهذا التطبيق قراءته/,
    invalid: /بصيغة يتعرف عليها هذا التطبيق/,
    readOnlyImportRefused: /للقراءة فقط، لذلك لا يمكنه الاستيراد/,
    alreadyRecovered: 'استرجع تبويب آخر بياناتك بالفعل',
  },
} as const;

function localeFor(testInfo: TestInfo): keyof typeof BACKUP_TEXT {
  return testInfo.project.name.endsWith('-ar') ? 'ar' : 'en';
}

/** Reads the `current` document straight out of IndexedDB, bypassing the app — the same technique
 * `multi-tab.spec.ts` and `smoke.spec.ts` already use. */
function readCurrentDocument(page: Page): Promise<unknown> {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open('sevenhabits');
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction('documents', 'readonly');
          const getRequest = tx.objectStore('documents').get('current');
          getRequest.onsuccess = () => resolve(getRequest.result);
          getRequest.onerror = () => reject(getRequest.error);
          tx.oncomplete = () => db.close();
        };
        request.onerror = () => reject(request.error);
      }),
  );
}

async function clickReplace(
  page: Page,
  text: (typeof BACKUP_TEXT)[keyof typeof BACKUP_TEXT],
): Promise<void> {
  await page.getByRole('button', { name: text.replaceButton }).click();
  await page.getByRole('button', { name: text.confirmReplaceButton }).click();
}

test.describe('JSON export/import', () => {
  test('export downloads a pretty-printed JSON file named sevenhabits-<date>.json', async ({
    page,
    seedDocument,
  }, testInfo) => {
    const text = BACKUP_TEXT[localeFor(testInfo)];
    await seedDocument({ settings: { marker: 'export-test' } });
    await page.goto('/settings');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: text.exportButton }).click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/^sevenhabits-\d{4}-\d{2}-\d{2}\.json$/);
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk as Buffer);
    }
    const content = Buffer.concat(chunks).toString('utf-8');
    expect(content).toContain('\n'); // pretty-printed
    const parsed = JSON.parse(content);
    expect(parsed.settings.marker).toBe('export-test');
    expect(parsed.meta.exportedAt).toBeTruthy();
  });

  test('export -> wipe -> import round trip restores the document', async ({
    page,
    seedDocument,
  }, testInfo) => {
    const text = BACKUP_TEXT[localeFor(testInfo)];
    await seedDocument({ settings: { marker: 'round-trip' } });
    await page.goto('/settings');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: text.exportButton }).click(),
    ]);
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk as Buffer);
    }
    const exported = Buffer.concat(chunks);

    // Wipe: clear IndexedDB directly (the same effect as "Start fresh") and reload to a fresh,
    // empty document.
    await page.evaluate(() => indexedDB.deleteDatabase('sevenhabits'));
    await page.reload();
    await page.getByRole('button', { name: text.importButton }).waitFor();

    await page.setInputFiles(FILE_INPUT, {
      name: 'sevenhabits-export.json',
      mimeType: 'application/json',
      buffer: exported,
    });
    await page.getByRole('button', { name: text.replaceButton }).waitFor();

    if (localeFor(testInfo) === 'ar') {
      // #163: the dialog's file/current dates are formatted through `AppDatePipe` (Intl) for the
      // active language, not Angular's built-in `date` pipe pinned to en-US — the unit test
      // (import-confirm-dialog.spec.ts) covers the formatting itself; this is the real-browser
      // check that Arabic actually renders that way, not the fixed en-US shape.
      const dateText = await page.locator('.import-confirm-dialog__dates dd').first().textContent();
      expect(dateText).toMatch(/[؀-ۿ]/);
    }

    await clickReplace(page, text);

    await expect(async () => {
      const current = (await readCurrentDocument(page)) as { settings: { marker: string } };
      expect(current.settings.marker).toBe('round-trip');
    }).toPass();

    // Survives a reload too, not just the in-memory replace.
    await page.reload();
    await expect(async () => {
      const current = (await readCurrentDocument(page)) as { settings: { marker: string } };
      expect(current.settings.marker).toBe('round-trip');
    }).toPass();
  });

  test('rejects a file that is not JSON, leaving the current document untouched', async ({
    page,
    seedDocument,
  }, testInfo) => {
    const text = BACKUP_TEXT[localeFor(testInfo)];
    await seedDocument({ settings: { marker: 'stays-put' } });
    await page.goto('/settings');

    await page.setInputFiles(FILE_INPUT, {
      name: 'not-json.json',
      mimeType: 'application/json',
      buffer: Buffer.from('this is not json'),
    });

    await expect(page.getByText(text.notJson)).toBeVisible();
    const current = (await readCurrentDocument(page)) as { settings: { marker: string } };
    expect(current.settings.marker).toBe('stays-put');
  });

  test('rejects a structurally invalid document, leaving the current document untouched', async ({
    page,
    seedDocument,
  }, testInfo) => {
    const text = BACKUP_TEXT[localeFor(testInfo)];
    await seedDocument({ settings: { marker: 'stays-put-2' } });
    await page.goto('/settings');

    await page.setInputFiles(FILE_INPUT, {
      name: 'invalid.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ schemaVersion: 1 })),
    });

    await expect(page.getByText(text.invalid)).toBeVisible();
    const current = (await readCurrentDocument(page)) as { settings: { marker: string } };
    expect(current.settings.marker).toBe('stays-put-2');
  });

  test('a read-only tab refuses to import', async ({ page, context, seedDocument }, testInfo) => {
    const text = BACKUP_TEXT[localeFor(testInfo)];
    await seedDocument({});
    await page.goto('/settings');
    const second = await context.newPage();
    await second.goto('/settings');
    await expect(second.locator('.read-only-banner')).toBeVisible();

    await second.getByRole('button', { name: text.importButton }).click();

    // The tab already shows the persistent `.read-only-banner`; this snackbar is the distinct,
    // refusal-specific message `triggerImport()` shows.
    await expect(second.getByText(text.readOnlyImportRefused)).toBeVisible();
  });

  // #150: importing a backup must be reachable from, and recover, the corrupt-data error page —
  // there was previously no import control there, and even with one the writer lock (never
  // started while corrupt) would have refused it.
  test('#150: recovers from a corrupt document by importing a backup', async ({
    page,
    context,
    seedDocument,
  }, testInfo) => {
    const text = BACKUP_TEXT[localeFor(testInfo)];
    // meta: undefined breaks isRootDocumentShape() (document.model.ts), the same as any other
    // structurally broken stored document — this always renders DataErrorPage instead of the
    // shell, regardless of route.
    await seedDocument({ meta: undefined as never });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: text.errorHeading })).toBeVisible();

    const backup = {
      schemaVersion: 1,
      meta: {
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        appVersion: '0.0.0',
        deviceId: '22222222-2222-4222-8222-222222222222',
      },
      profile: {},
      settings: { marker: 'recovered-from-corrupt' },
      shared: {},
      habits: {
        paradigms: {},
        h1: {},
        h2: {},
        h3: {},
        h4: {},
        h5: {},
        h6: {},
        h7: {},
        interdependence: {},
      },
      extras: {},
    };
    await page.setInputFiles(FILE_INPUT, {
      name: 'sevenhabits-backup.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(backup)),
    });

    // The error page swaps for the shell once recovery reports ready.
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(text.appName);
    await expect(async () => {
      const current = (await readCurrentDocument(page)) as { settings: { marker: string } };
      expect(current.settings.marker).toBe('recovered-from-corrupt');
    }).toPass();

    // Survives in a fresh page with no seed script of its own — proves DocumentSync (and with it
    // the writer lock and autosave) actually started and genuinely saved it, not just that the
    // document was replaced in memory. (Reloading `page` itself doesn't prove this: `seedDocument`
    // re-seeds the original corrupt document on every navigation of that page, by design — see
    // `fixtures.ts` — which would mask a real persistence failure here.)
    const fresh = await context.newPage();
    await fresh.goto('/');
    await expect(fresh.getByRole('heading', { level: 1 })).toHaveText(text.appName);
    const current = (await readCurrentDocument(fresh)) as { settings: { marker: string } };
    expect(current.settings.marker).toBe('recovered-from-corrupt');
  });

  // #158/#160/#161: every tab open when the document went corrupt is on the error page, and only
  // the first to import may recover it. The second tab's import is refused with a message (#160),
  // and — the step that actually lost data in #158 — it must not save that import once the first
  // tab closes and it takes over as the writer (#161: this test must close tab 1).
  test("#158: a second corrupt tab's import is refused and never overwrites the first tab's recovery, even after it takes over", async ({
    page,
    context,
    seedDocument,
  }, testInfo) => {
    const text = BACKUP_TEXT[localeFor(testInfo)];
    const REMINDER_SELECT = '#backup-reminder-days';
    const READ_ONLY_BANNER = '.read-only-banner';

    function backupFile(marker: string) {
      const backup = {
        schemaVersion: 1,
        meta: {
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          appVersion: '0.0.0',
          deviceId: '22222222-2222-4222-8222-222222222222',
        },
        profile: {},
        settings: { marker },
        shared: {},
        habits: {
          paradigms: {},
          h1: {},
          h2: {},
          h3: {},
          h4: {},
          h5: {},
          h6: {},
          h7: {},
          interdependence: {},
        },
        extras: {},
      };
      return {
        name: `${marker}.json`,
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(backup)),
      };
    }

    async function readStored(from: Page) {
      const current = (await readCurrentDocument(from)) as {
        settings: { marker: string; backup?: { reminderDays: number } };
      };
      return {
        marker: current.settings.marker,
        reminderDays: current.settings.backup?.reminderDays,
      };
    }

    await seedDocument({ meta: undefined as never });
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: text.errorHeading })).toBeVisible();
    // A second tab, open before either has recovered. It has no `seedDocument` init script of its
    // own (see #150's test above), so its reload after taking over reads what is really stored.
    const second = await context.newPage();
    await second.goto('/settings');
    await expect(second.getByRole('heading', { name: text.errorHeading })).toBeVisible();

    // Tab 1 recovers, becomes the writer, then edits.
    await page.setInputFiles(FILE_INPUT, backupFile('tab-1-recovered'));
    await page.locator(REMINDER_SELECT).selectOption('30');
    await expect
      .poll(() => readStored(page))
      .toEqual({ marker: 'tab-1-recovered', reminderDays: 30 });

    // Tab 2, still on the error page, imports an older file: refused, with a message, and it shows
    // tab 1's stored document rather than its own unsaved import (#160).
    await second.setInputFiles(FILE_INPUT, backupFile('tab-2-stale'));
    await expect(second.getByText(text.alreadyRecovered)).toBeVisible();
    await expect(second.locator(READ_ONLY_BANNER)).toBeVisible();
    await expect(second.locator(REMINDER_SELECT)).toHaveValue('30');

    // Tab 1 closes: tab 2 is promoted to writer and reloads (`WriterPromotionReload`).
    const secondReloaded = second.waitForEvent('load');
    await page.close();
    await secondReloaded;
    await expect(second.locator(READ_ONLY_BANNER)).toHaveCount(0, { timeout: 10_000 });
    await expect(second.locator(REMINDER_SELECT)).toHaveValue('30');
    // Give any save tab 2 might still attempt after taking over time to land before checking.
    await second.waitForTimeout(1500);
    expect(await readStored(second)).toEqual({ marker: 'tab-1-recovered', reminderDays: 30 });
    await expect(second.locator(REMINDER_SELECT)).toHaveValue('30');
  });
});
