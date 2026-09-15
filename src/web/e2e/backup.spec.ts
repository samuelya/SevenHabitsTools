import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * Exercises JSON export/import end to end (issue #37): export downloads a file, a full
 * export → wipe → import round trip restores the document (architecture issue #1 §9's reload/
 * round-trip bar), an invalid file is rejected without touching the current document, and a
 * read-only tab refuses to import.
 */

const EXPORT_BUTTON = 'Export data';
const IMPORT_BUTTON = 'Import data';
const FILE_INPUT = 'input[type="file"]';

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

async function clickReplace(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Replace…' }).click();
  await page.getByRole('button', { name: 'Yes, replace' }).click();
}

test.describe('JSON export/import', () => {
  test('export downloads a pretty-printed JSON file named sevenhabits-<date>.json', async ({
    page,
    seedDocument,
  }) => {
    await seedDocument({ settings: { marker: 'export-test' } });
    await page.goto('/settings');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: EXPORT_BUTTON }).click(),
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
  }) => {
    await seedDocument({ settings: { marker: 'round-trip' } });
    await page.goto('/settings');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: EXPORT_BUTTON }).click(),
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
    await page.getByRole('button', { name: IMPORT_BUTTON }).waitFor();

    await page.setInputFiles(FILE_INPUT, {
      name: 'sevenhabits-export.json',
      mimeType: 'application/json',
      buffer: exported,
    });
    await page.getByRole('button', { name: 'Replace…' }).waitFor();
    await clickReplace(page);

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
  }) => {
    await seedDocument({ settings: { marker: 'stays-put' } });
    await page.goto('/settings');

    await page.setInputFiles(FILE_INPUT, {
      name: 'not-json.json',
      mimeType: 'application/json',
      buffer: Buffer.from('this is not json'),
    });

    await expect(page.getByText(/JSON file this app can read/i)).toBeVisible();
    const current = (await readCurrentDocument(page)) as { settings: { marker: string } };
    expect(current.settings.marker).toBe('stays-put');
  });

  test('rejects a structurally invalid document, leaving the current document untouched', async ({
    page,
    seedDocument,
  }) => {
    await seedDocument({ settings: { marker: 'stays-put-2' } });
    await page.goto('/settings');

    await page.setInputFiles(FILE_INPUT, {
      name: 'invalid.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ schemaVersion: 1 })),
    });

    await expect(page.getByText(/data isn't in a shape/i)).toBeVisible();
    const current = (await readCurrentDocument(page)) as { settings: { marker: string } };
    expect(current.settings.marker).toBe('stays-put-2');
  });

  test('a read-only tab refuses to import', async ({ page, context, seedDocument }) => {
    await seedDocument({});
    await page.goto('/settings');
    const second = await context.newPage();
    await second.goto('/settings');
    await expect(second.locator('.read-only-banner')).toBeVisible();

    await second.getByRole('button', { name: IMPORT_BUTTON }).click();

    // The tab already shows the persistent `.read-only-banner`; this snackbar is the distinct,
    // refusal-specific message `triggerImport()` shows.
    await expect(second.getByText(/read-only, so it can't import/i)).toBeVisible();
  });

  // #150: importing a backup must be reachable from, and recover, the corrupt-data error page —
  // there was previously no import control there, and even with one the writer lock (never
  // started while corrupt) would have refused it.
  test('#150: recovers from a corrupt document by importing a backup', async ({
    page,
    context,
    seedDocument,
  }) => {
    // meta: undefined breaks isRootDocumentShape() (document.model.ts), the same as any other
    // structurally broken stored document — this always renders DataErrorPage instead of the
    // shell, regardless of route.
    await seedDocument({ meta: undefined as never });
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: "We couldn't read your saved data" }),
    ).toBeVisible();

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
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Seven Habits Tools');
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
    await expect(fresh.getByRole('heading', { level: 1 })).toHaveText('Seven Habits Tools');
    const current = (await readCurrentDocument(fresh)) as { settings: { marker: string } };
    expect(current.settings.marker).toBe('recovered-from-corrupt');
  });
});
