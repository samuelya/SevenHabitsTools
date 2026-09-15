import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * Exercises the writer lock end to end (issue #35): exactly one tab may write at a time, every
 * other tab shows the read-only banner, and closing the writer's tab lets a reader take over.
 *
 * There is no editable exercise UI yet — every habit page is still a placeholder (#1's habit
 * exercises land in later issues) — so a real user edit can't be authored through the UI to
 * trigger a save. The "writer saves, the reader never overwrites it" test below instead writes to
 * IndexedDB and broadcasts on the same `BroadcastChannel` `CrossTabSync` uses, the same technique
 * `seedDocument` already relies on to get data into the app ahead of its own bootstrap (see
 * `docs/testing.md`). `CrossTabSync`'s reaction to that broadcast is otherwise covered by its own
 * unit tests (`src/app/core/data/multi-tab/cross-tab-sync.spec.ts`).
 */

const READ_ONLY_BANNER = '.read-only-banner';

/** `data.readOnly.banner`'s opening words, in both languages — the `-ar` projects render Arabic
 * by default (the browser locale, per `playwright.config.ts`), not just when a spec seeds it. */
const READ_ONLY_BANNER_TEXT = { en: 'Read-only', ar: 'للقراءة فقط' } as const;

/** Waits until `page` actually holds the Web Lock, so a second tab opened afterwards is
 * deterministically the reader (the lock is requested after bootstrap, some time after `load`). */
async function waitForWebLockHeld(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(async () =>
        (await navigator.locks.query()).held?.some((lock) => lock.name === 'sevenhabits-writer'),
      ),
    )
    .toBe(true);
}

/** Heartbeat fallback: waits until `page` has written its heartbeat and the claim's read-back
 * confirmation (100 ms) has passed. */
async function waitForHeartbeatClaimed(page: Page): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('sevenhabits-writer-heartbeat')))
    .not.toBeNull();
  await page.waitForTimeout(300);
}

/** Counts full page loads of `page` from now on (a reload fires `load` once). */
function countLoads(page: Page): () => number {
  let loads = 0;
  page.on('load', () => loads++);
  return () => loads;
}

/** Reads the `current` document straight out of IndexedDB, bypassing the app. */
function readIndexedDbKey(page: Page, key: string): Promise<unknown> {
  return page.evaluate(
    (k) =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open('sevenhabits');
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction('documents', 'readonly');
          const getRequest = tx.objectStore('documents').get(k);
          getRequest.onsuccess = () => resolve(getRequest.result);
          getRequest.onerror = () => reject(getRequest.error);
          tx.oncomplete = () => db.close();
        };
        request.onerror = () => reject(request.error);
      }),
    key,
  );
}

test.describe('multi-tab writer lock', () => {
  test('only one tab is the writer; every other tab shows the read-only banner', async ({
    page,
    context,
    seedDocument,
  }, testInfo) => {
    await seedDocument({});
    await page.goto('/settings');
    await waitForWebLockHeld(page);
    await expect(page.locator(READ_ONLY_BANNER)).toHaveCount(0);

    const second = await context.newPage();
    await second.goto('/settings');

    await expect(second.locator(READ_ONLY_BANNER)).toBeVisible();
    const bannerText = testInfo.project.name.endsWith('-ar')
      ? READ_ONLY_BANNER_TEXT.ar
      : READ_ONLY_BANNER_TEXT.en;
    await expect(second.locator(READ_ONLY_BANNER)).toContainText(bannerText);
  });

  test("the reader never overwrites the writer's save", async ({ page, context, seedDocument }) => {
    await seedDocument({ settings: { e2eMarker: 'initial' } });
    await page.goto('/settings');
    await waitForWebLockHeld(page);
    const second = await context.newPage();
    await second.goto('/settings');
    await expect(second.locator(READ_ONLY_BANNER)).toBeVisible();

    // Simulate the writer completing a save and notifying other tabs, the same way the real
    // `IndexedDbAdapter`/`CrossTabSync` do — see the file doc comment for why this isn't done
    // through the UI. This raw write never touches `backup-previous`, unlike a real
    // `IndexedDbAdapter.save()` call.
    await page.evaluate(
      () =>
        new Promise<void>((resolve, reject) => {
          const request = indexedDB.open('sevenhabits');
          request.onsuccess = () => {
            const db = request.result;
            const tx = db.transaction('documents', 'readwrite');
            const store = tx.objectStore('documents');
            const getRequest = store.get('current');
            getRequest.onsuccess = () => {
              const doc = getRequest.result as { settings: Record<string, unknown> };
              doc.settings['e2eMarker'] = 'from-writer';
              store.put(doc, 'current');
            };
            tx.oncomplete = () => {
              db.close();
              new BroadcastChannel('sevenhabits-sync').postMessage({ type: 'saved' });
              resolve();
            };
            tx.onerror = () => reject(tx.error);
          };
          request.onerror = () => reject(request.error);
        }),
    );

    // Longer than the 500 ms save debounce: if the reader had (wrongly) reacted to its reloaded
    // document by scheduling a save of its own, it would have run by now.
    await second.waitForTimeout(1000);

    const current = await readIndexedDbKey(second, 'current');
    expect((current as { settings: { e2eMarker: string } }).settings.e2eMarker).toBe('from-writer');
    // A real save from the reader would have copied `current` into `backup-previous`; the raw
    // write above never touches it, so its continued absence proves the reader never saved.
    const backup = await readIndexedDbKey(second, 'backup-previous');
    expect(backup).toBeUndefined();
  });

  test('closing the writer tab lets the reader take over', async ({
    page,
    context,
    seedDocument,
  }) => {
    await seedDocument({});
    await page.goto('/settings');
    await waitForWebLockHeld(page);
    const second = await context.newPage();
    await second.goto('/settings');
    await expect(second.locator(READ_ONLY_BANNER)).toBeVisible();

    const secondLoads = countLoads(second);

    await page.close();

    // WriterPromotionReload reloads `second` once it is promoted; wait for the outcome (the banner
    // gone), then check it reloaded exactly once and stays settled.
    await expect(second.locator(READ_ONLY_BANNER)).toHaveCount(0, { timeout: 10_000 });
    await second.waitForTimeout(2000);
    expect(secondLoads()).toBe(1);
  });

  test('#125: a single tab becomes the writer without reloading itself', async ({
    page,
    seedDocument,
  }) => {
    await seedDocument({});
    const loads = countLoads(page);

    await page.goto('/settings');
    await page.waitForTimeout(3000);

    expect(loads()).toBe(1);
    await expect(page.locator(READ_ONLY_BANNER)).toHaveCount(0);
  });
});

test.describe('multi-tab writer lock, localStorage heartbeat fallback (no Web Locks)', () => {
  test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, 'locks', {
        get: () => undefined,
        configurable: true,
      });
    });
  });

  test('#126: a single tab becomes the writer without reloading itself', async ({
    page,
    seedDocument,
  }) => {
    await seedDocument({});
    const loads = countLoads(page);

    await page.goto('/settings');
    await page.waitForTimeout(8000);

    expect(loads()).toBe(1);
    await expect(page.locator(READ_ONLY_BANNER)).toHaveCount(0);
  });

  test('#126: the reader takes over once, and only once, after the writer closes', async ({
    page,
    context,
    seedDocument,
  }) => {
    test.slow();
    await seedDocument({});
    await page.goto('/settings');
    await waitForHeartbeatClaimed(page);
    await expect(page.locator(READ_ONLY_BANNER)).toHaveCount(0);
    const second = await context.newPage();
    await second.goto('/settings');
    await expect(second.locator(READ_ONLY_BANNER)).toBeVisible();
    // While the writer is alive, the reader stays put: no takeover, no reloads.
    const secondLoads = countLoads(second);
    await second.waitForTimeout(8000);
    expect(secondLoads()).toBe(0);
    await expect(second.locator(READ_ONLY_BANNER)).toBeVisible();

    await page.close();

    // Stale threshold (5 s) plus one poll (2 s) at most, with margin.
    await expect(second.locator(READ_ONLY_BANNER)).toHaveCount(0, { timeout: 12_000 });
    await second.waitForTimeout(8000);
    expect(secondLoads()).toBe(1);
    await expect(second.locator(READ_ONLY_BANNER)).toHaveCount(0);
  });
});
