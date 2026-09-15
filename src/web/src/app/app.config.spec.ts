import { ApplicationInitStatus } from '@angular/core';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { IDBFactory } from 'fake-indexeddb';
import { appConfig } from './app.config';
import { INDEXED_DB } from './core/browser/indexed-db';
import { DocumentBootstrapStatus } from './core/data/document-bootstrap-status';
import { DocumentSync } from './core/data/document-sync';
import { DocumentStore } from './core/data/document.store';
import { IndexedDbAdapter } from './core/data/indexeddb/indexeddb-adapter';
import { WRITER_LOCK } from './core/data/multi-tab/writer-lock';
import { WriterLockService } from './core/data/multi-tab/writer-lock.service';
import { STORAGE_ADAPTER } from './core/data/storage-adapter';

/**
 * #124: resolves the data services from the real `appConfig` providers, with no `NoopAdapter`
 * swap (unlike `configureApp()` in `testing/app-test-setup.ts`), so a DI break in any of them fails
 * `npm test` instead of only showing up as a blank page in the browser. Only the `indexedDB`
 * browser global is replaced, because jsdom doesn't implement it.
 */
describe('appConfig data providers', () => {
  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        ...appConfig.providers,
        { provide: INDEXED_DB, useValue: new IDBFactory() },
        // Swaps `provideAppTransloco()`'s real HTTP loader for the testing backend below —
        // `LanguageSync.initialize()` now runs in this same initializer chain and fetches the
        // root i18n scope for the browser's (jsdom's) default language, `en`.
        provideHttpClientTesting(),
      ],
    });
    // Let the app initializers (bootstrap over the real adapter, then LanguageSync and
    // DocumentSync) finish inside the test instead of after TestBed has torn the injector down.
    const donePromise = TestBed.inject(ApplicationInitStatus).donePromise;
    const httpMock = TestBed.inject(HttpTestingController);
    // The i18n request fires only once `bootstrapDocument()`'s own (real, fake-indexeddb) async
    // round trip resolves, so it isn't there on the very next tick yet — poll for it instead of
    // asserting immediately. `match()` (unlike `expectOne()`) consumes what it finds, so a single
    // call both checks and retrieves the request.
    let request;
    for (let attempt = 0; !request && attempt < 50; attempt++) {
      [request] = httpMock.match('assets/i18n/en.json');
      if (!request) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
    if (!request) {
      throw new Error('The "assets/i18n/en.json" request never arrived.');
    }
    request.flush({});
    await donePromise;
  });

  it('#124: resolves STORAGE_ADAPTER to the real IndexedDbAdapter', () => {
    expect(TestBed.inject(STORAGE_ADAPTER)).toBeInstanceOf(IndexedDbAdapter);
  });

  it('#124: the resolved adapter saves and loads through IndexedDB', async () => {
    const adapter = TestBed.inject(STORAGE_ADAPTER);
    const doc = TestBed.inject(DocumentStore).document();

    await adapter.save(doc, { reason: 'flush' });

    await expect(adapter.load()).resolves.toEqual(doc);
  });

  it('#124: binds WRITER_LOCK to WriterLockService', () => {
    expect(TestBed.inject(WRITER_LOCK)).toBe(TestBed.inject(WriterLockService));
  });

  it('#124: resolves DocumentSync, and bootstrap over the real adapter reaches ready', () => {
    expect(TestBed.inject(DocumentSync)).toBeInstanceOf(DocumentSync);
    expect(TestBed.inject(DocumentBootstrapStatus).state()).toBe('ready');
  });

  it('#149: composes settings.language, settings.numerals and settings.pwa together, regardless of registration order', () => {
    // settings.model.ts (settings.language, settings.numerals) and pwa.model.ts (settings.pwa)
    // all register independent leaves under `settings` — createEmptyDocument() composes each
    // registration's own path directly, so none of them can overwrite a sibling the way a single
    // whole-`settings`-object registration would.
    const settings = TestBed.inject(DocumentStore).document().settings as Record<string, unknown>;
    expect(settings).toMatchObject({ language: null, numerals: 'western' });
    expect(settings['pwa']).toEqual({ installPromptDismissedAt: null });
  });
});
