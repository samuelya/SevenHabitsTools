import { test as base, expect, type Page } from '@playwright/test';

/**
 * Loose shape of the stored document. Specs only need to set a slice or two; they should not
 * have to depend on the app's internal `RootDocument` type (`src/app/core/data/document.model.ts`)
 * across the Playwright/Angular build boundary.
 */
export type SeedDocument = Record<string, unknown>;

const DB_NAME = 'sevenhabits';
const STORE_NAME = 'documents';
const DOCUMENT_KEY = 'current';

/**
 * A structurally valid, empty document — see `docs/data-model.md` and `isRootDocumentShape()`
 * (`document.model.ts`). `seedDocument()` shallow-merges its argument on top of this.
 */
function defaultDocument(): SeedDocument {
  return {
    schemaVersion: 1,
    meta: {
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      appVersion: '0.0.0',
      deviceId: '11111111-1111-4111-8111-111111111111',
    },
    profile: {},
    settings: {},
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
}

/** Distinguishes each `writeDocumentOnNextNavigation()` call's own marker, so a later call's
 * script (e.g. `setLanguage` after `seedDocument`) still writes on the next navigation even
 * though an earlier call's script has already set its own marker. */
let seedCallCounter = 0;

/**
 * Writes `doc` to IndexedDB (database `sevenhabits`, object store `documents`, key `current`) —
 * the schema `IndexedDbAdapter` (issue #35) reads from — before the app's own bootstrap gets a
 * chance to read it. Registered as a `page.addInitScript` rather than a plain `page.evaluate` so
 * it runs on the *next* navigation, before any of the page's own scripts: seeding only works if
 * it lands before the app's bootstrap, and the app hasn't navigated yet when a fixture runs.
 *
 * `page.addInitScript` re-runs this on *every* navigation of the page, including `page.reload()`
 * (#157): without a guard, a test that seeds, reloads and then asserts the data is still there
 * would pass even if `IndexedDbAdapter.load()`/`save()` were completely broken, because the
 * reload's own init script would silently re-plant the exact value being asserted. Each call gets
 * a unique `sessionStorage` marker (session storage survives a reload of the same tab, but not a
 * new page/tab or a fresh context) that its script checks before writing and sets after: the
 * first navigation after a `seedDocument`/`setLanguage` call still seeds, but every later
 * navigation of that same page — a `reload()` above all — sees the marker already set and skips
 * the write, leaving IndexedDB to whatever the app itself actually persisted.
 */
async function writeDocumentOnNextNavigation(page: Page, doc: SeedDocument): Promise<void> {
  const marker = `sevenhabits-e2e-seed-${++seedCallCounter}`;
  await page.addInitScript(
    ({ dbName, storeName, key, value, marker }) => {
      if (sessionStorage.getItem(marker)) {
        return;
      }
      const openRequest = indexedDB.open(dbName);
      openRequest.onupgradeneeded = () => {
        if (!openRequest.result.objectStoreNames.contains(storeName)) {
          openRequest.result.createObjectStore(storeName);
        }
      };
      openRequest.onsuccess = () => {
        const db = openRequest.result;
        const tx = db.transaction(storeName, 'readwrite');
        tx.objectStore(storeName).put(value, key);
        tx.oncomplete = () => {
          db.close();
          sessionStorage.setItem(marker, '1');
        };
        tx.onerror = () => db.close();
      };
    },
    { dbName: DB_NAME, storeName: STORE_NAME, key: DOCUMENT_KEY, value: doc, marker },
  );
}

export interface SevenHabitsFixtures {
  /**
   * Seeds IndexedDB with `doc` merged onto `defaultDocument()`, before the next navigation of
   * `page`. Seeds once: later navigations of the same `page`, `page.reload()` above all, are left
   * alone and reflect whatever the app actually persisted (see
   * `writeDocumentOnNextNavigation()`'s doc comment). Use `context.newPage()` instead when a test
   * needs a page with no seed init script at all (e.g. a genuinely fresh second tab).
   */
  seedDocument(doc: SeedDocument): Promise<void>;
  /**
   * Content-Security-Policy violations reported by the page since the fixture was set up (empty
   * array, appended to as `securitypolicyviolation` events fire). The suite serves the build
   * behind the same CSP production sends (`e2e/static-server.mjs`), so this catches the class of
   * bug in issue #118: a build artifact (e.g. an inlined `onload` handler) that only "works"
   * because a dev server or a plainer static server is more permissive than production.
   */
  cspViolations: string[];
  /**
   * Seeds `settings.language` (`settings.language: 'en' | 'ar'`, per issue #28's data model)
   * before the next navigation of `page`. Same "seeds once" rule as `seedDocument` above. Combine
   * with `seedDocument` by passing `{ settings: { language } }` to it directly instead — this
   * fixture always seeds a fresh default document, so calling both against the same page would
   * have the later call's write win.
   */
  setLanguage(lang: 'en' | 'ar'): Promise<void>;
  /** Disables the browser context's network, simulating the device going offline after first load. */
  goOffline(): Promise<void>;
}

export const test = base.extend<SevenHabitsFixtures>({
  seedDocument: async ({ page }, use) => {
    await use(async (doc) => {
      await writeDocumentOnNextNavigation(page, { ...defaultDocument(), ...doc });
    });
  },

  setLanguage: async ({ page }, use) => {
    await use(async (lang) => {
      const doc = defaultDocument();
      doc['settings'] = { language: lang };
      await writeDocumentOnNextNavigation(page, doc);
    });
  },

  goOffline: async ({ context }, use) => {
    await use(async () => {
      await context.setOffline(true);
    });
  },

  cspViolations: async ({ page }, use) => {
    const violations: string[] = [];
    await page.exposeFunction('__reportCspViolation', (description: string) => {
      violations.push(description);
    });
    await page.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', (event) => {
        // Exposed by the `cspViolations` fixture just above; not available outside a test run.
        (
          window as unknown as { __reportCspViolation(description: string): void }
        ).__reportCspViolation(
          `${event.violatedDirective} blocked ${event.blockedURI || event.sourceFile || 'inline content'}`,
        );
      });
    });
    await use(violations);
  },
});

export { expect };
