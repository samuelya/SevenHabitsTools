import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IDBFactory } from 'fake-indexeddb';
import { BROADCAST_CHANNEL_FACTORY } from '../../browser/broadcast-channel';
import { FileDownloader } from '../../browser/file-download';
import { INDEXED_DB } from '../../browser/indexed-db';
import { WINDOW } from '../../browser/window';
import { DEVICE_ID_SOURCE } from '../../device/device-id-source';
import { DocumentBootstrapStatus } from '../document-bootstrap-status';
import { DocumentPersistence } from '../document-persistence';
import { RootDocument } from '../document.model';
import { DocumentStore } from '../document.store';
import { IndexedDbAdapter } from '../indexeddb/indexeddb-adapter';
import { WriterLockService } from '../multi-tab/writer-lock.service';
import { STORAGE_ADAPTER } from '../storage-adapter';
import { DataErrorPage } from './data-error-page';

function text(fixture: ComponentFixture<DataErrorPage>, selector: string): string {
  return (fixture.nativeElement as HTMLElement).querySelector(selector)?.textContent?.trim() ?? '';
}

function buttons(fixture: ComponentFixture<DataErrorPage>): HTMLButtonElement[] {
  return [...fixture.nativeElement.querySelectorAll('button')];
}

describe('DataErrorPage', () => {
  const adapter = {
    kind: 'noop',
    load: vi.fn(),
    save: vi.fn(),
    clear: vi.fn().mockResolvedValue(undefined),
  };
  const reload = vi.fn();

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: STORAGE_ADAPTER, useValue: adapter },
        { provide: DEVICE_ID_SOURCE, useValue: { id: () => 'device-1' } },
        {
          provide: WINDOW,
          useValue: {
            location: { reload },
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
          },
        },
        // DocumentSync.start() (called from reset()) starts the whole multi-tab sync stack;
        // these two keep it from touching a real BroadcastChannel or leaving a real interval
        // running after the test, neither of which this spec is about.
        { provide: BROADCAST_CHANNEL_FACTORY, useValue: () => null },
        {
          provide: WriterLockService,
          useValue: {
            start: vi.fn(),
            stop: vi.fn(),
            role: signal('writer'),
            isWriter: signal(true),
            promoted: signal(false),
          },
        },
      ],
    });
    adapter.clear.mockClear();
    reload.mockClear();
  });

  it('shows "Try again" and "Start fresh" but no export button when there is no raw data', () => {
    TestBed.inject(DocumentBootstrapStatus).reportCorrupt(null, new Error('boom'));
    const fixture = TestBed.createComponent(DataErrorPage);
    fixture.detectChanges();

    expect(text(fixture, 'p')).toBe(
      'The saved file is damaged or in a format this app cannot read.',
    );
    expect(buttons(fixture).map((button) => button.textContent?.trim())).toEqual([
      'Try again',
      'Start fresh',
    ]);
  });

  it('retry() reloads the page', () => {
    TestBed.inject(DocumentBootstrapStatus).reportCorrupt(null, new Error('boom'));
    const fixture = TestBed.createComponent(DataErrorPage);
    fixture.detectChanges();

    buttons(fixture)[0].click();

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('shows the export button when raw data is available, and downloads it on click', () => {
    const download = vi.fn();
    TestBed.overrideProvider(FileDownloader, { useValue: { download } });
    const status = TestBed.inject(DocumentBootstrapStatus);
    status.reportCorrupt({ schemaVersion: 99 }, new Error('boom'));
    const fixture = TestBed.createComponent(DataErrorPage);
    fixture.detectChanges();

    const exportButton = buttons(fixture).find((button) => button.textContent?.includes('Export'));
    exportButton?.click();

    expect(download).toHaveBeenCalledWith(
      'seven-habits-tools-backup.json',
      JSON.stringify({ schemaVersion: 99 }, null, 2),
    );
  });

  it('"Start fresh" shows a confirmation instead of clearing storage immediately', () => {
    TestBed.inject(DocumentBootstrapStatus).reportCorrupt({ schemaVersion: 99 }, new Error('boom'));
    const fixture = TestBed.createComponent(DataErrorPage);
    fixture.detectChanges();

    const startFresh = buttons(fixture).find((button) =>
      button.textContent?.includes('Start fresh'),
    );
    startFresh?.click();
    fixture.detectChanges();

    expect(adapter.clear).not.toHaveBeenCalled();
    expect(text(fixture, '.data-error-page__confirm')).toContain('permanently delete');
    const confirmButtons = buttons(fixture).map((button) => button.textContent?.trim());
    expect(confirmButtons).toEqual(['Cancel', 'Yes, start fresh']);
  });

  it('moves focus to Cancel when the confirmation appears', () => {
    TestBed.inject(DocumentBootstrapStatus).reportCorrupt({ schemaVersion: 99 }, new Error('boom'));
    const fixture = TestBed.createComponent(DataErrorPage);
    fixture.detectChanges();

    buttons(fixture)
      .find((button) => button.textContent?.includes('Start fresh'))
      ?.click();
    fixture.detectChanges();

    expect(document.activeElement?.textContent?.trim()).toBe('Cancel');
  });

  it('Cancel returns to the initial view without clearing storage', () => {
    TestBed.inject(DocumentBootstrapStatus).reportCorrupt({ schemaVersion: 99 }, new Error('boom'));
    const fixture = TestBed.createComponent(DataErrorPage);
    fixture.detectChanges();
    buttons(fixture)
      .find((button) => button.textContent?.includes('Start fresh'))
      ?.click();
    fixture.detectChanges();

    buttons(fixture)
      .find((button) => button.textContent?.includes('Cancel'))
      ?.click();
    fixture.detectChanges();

    expect(adapter.clear).not.toHaveBeenCalled();
    expect(buttons(fixture).map((button) => button.textContent?.trim())).toEqual([
      'Try again',
      'Export raw file',
      'Start fresh',
    ]);
  });

  it('confirming reset clears storage, replaces the document and reports ready', async () => {
    const status = TestBed.inject(DocumentBootstrapStatus);
    status.reportCorrupt({ schemaVersion: 99 }, new Error('boom'));
    const fixture = TestBed.createComponent(DataErrorPage);
    fixture.detectChanges();
    const store = TestBed.inject(DocumentStore);

    buttons(fixture)
      .find((button) => button.textContent?.includes('Start fresh'))
      ?.click();
    fixture.detectChanges();
    buttons(fixture)
      .find((button) => button.textContent?.includes('Yes, start fresh'))
      ?.click();
    await fixture.whenStable();

    expect(adapter.clear).toHaveBeenCalledTimes(1);
    expect(store.document().meta.deviceId).toBe('device-1');
    expect(status.state()).toBe('ready');
  });

  it('starts persistence on reset, since it was never started while corrupt', async () => {
    TestBed.inject(DocumentBootstrapStatus).reportCorrupt({ schemaVersion: 99 }, new Error('boom'));
    const fixture = TestBed.createComponent(DataErrorPage);
    fixture.detectChanges();
    const persistence = TestBed.inject(DocumentPersistence);
    const store = TestBed.inject(DocumentStore);

    buttons(fixture)
      .find((button) => button.textContent?.includes('Start fresh'))
      ?.click();
    fixture.detectChanges();
    buttons(fixture)
      .find((button) => button.textContent?.includes('Yes, start fresh'))
      ?.click();
    await fixture.whenStable();

    expect(persistence.dirty()).toBe(false);
    store.update('settings', () => ({ theme: 'dark' }));
    TestBed.tick();
    expect(persistence.dirty()).toBe(true);
  });

  it('"Start fresh" removes the current document but keeps backup-previous', async () => {
    const idb = new IDBFactory();
    TestBed.overrideProvider(INDEXED_DB, { useValue: idb });
    TestBed.overrideProvider(STORAGE_ADAPTER, { useFactory: () => new IndexedDbAdapter() });
    const realAdapter = TestBed.inject(STORAGE_ADAPTER);
    const older = { schemaVersion: 1, marker: 'older' } as unknown as RootDocument;
    const corrupt = { schemaVersion: 99, marker: 'corrupt' } as unknown as RootDocument;
    await realAdapter.save(older, { reason: 'flush' });
    await realAdapter.save(corrupt, { reason: 'flush' });
    TestBed.inject(DocumentBootstrapStatus).reportCorrupt(corrupt, new Error('boom'));
    const fixture = TestBed.createComponent(DataErrorPage);
    fixture.detectChanges();

    buttons(fixture)
      .find((button) => button.textContent?.includes('Start fresh'))
      ?.click();
    fixture.detectChanges();
    buttons(fixture)
      .find((button) => button.textContent?.includes('Yes, start fresh'))
      ?.click();
    await fixture.whenStable();

    await expect(realAdapter.load()).resolves.toBeNull();
    await expect(readRawKey(idb, 'backup-previous')).resolves.toEqual(older);
  });
});

/** Reads `key` straight out of the IndexedDB object store, bypassing the adapter. */
function readRawKey(idb: IDBFactory, key: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const open = idb.open('sevenhabits');
    open.onsuccess = () => {
      const request = open.result.transaction('documents').objectStore('documents').get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    };
    open.onerror = () => reject(open.error);
  });
}
