import { ApplicationInitStatus } from '@angular/core';
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
      providers: [...appConfig.providers, { provide: INDEXED_DB, useValue: new IDBFactory() }],
    });
    // Let the app initializers (bootstrap over the real adapter, then DocumentSync) finish inside
    // the test instead of after TestBed has torn the injector down.
    await TestBed.inject(ApplicationInitStatus).donePromise;
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
});
