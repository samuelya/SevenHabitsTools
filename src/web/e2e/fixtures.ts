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

/**
 * Writes `doc` to IndexedDB (database `sevenhabits`, object store `documents`, key `current`) —
 * the schema issue #35 (IndexedDB adapter) specifies — before the app's own bootstrap gets a
 * chance to read it. Registered as a `page.addInitScript` rather than a plain `page.evaluate` so
 * it runs on the *next* navigation, before any of the page's own scripts: seeding only works if
 * it lands before the app's bootstrap, and the app hasn't navigated yet when a fixture runs.
 *
 * #35 hasn't landed: the app is wired to `NoopAdapter` today (`app.config.ts`) and never reads
 * this. Specs that depend on a seed surviving a reload are `test.fixme`, pointing at #35.
 */
async function writeDocumentOnNextNavigation(page: Page, doc: SeedDocument): Promise<void> {
  await page.addInitScript(
    ({ dbName, storeName, key, value }) => {
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
        tx.oncomplete = () => db.close();
        tx.onerror = () => db.close();
      };
    },
    { dbName: DB_NAME, storeName: STORE_NAME, key: DOCUMENT_KEY, value: doc },
  );
}

export interface SevenHabitsFixtures {
  /** Seeds IndexedDB with `doc` merged onto `defaultDocument()`, before the next navigation. */
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
   * before the next navigation. Combine with `seedDocument` by passing `{ settings: { language } }`
   * to it directly instead — this fixture always seeds a fresh default document, so calling both
   * against the same page would have the later call's write win.
   *
   * Transloco and the language switcher don't exist yet (#28): the app never reads this seed and
   * always renders `en`. Specs asserting the UI actually changed language are `test.fixme`,
   * pointing at #28.
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
