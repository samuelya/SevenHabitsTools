import { IDBFactory } from 'fake-indexeddb';
import { TestBed } from '@angular/core/testing';
import { INDEXED_DB } from '../../browser/indexed-db';
import { describeStorageAdapterContract } from '../storage-adapter.contract';
import { RootDocument } from '../document.model';
import { StorageAdapter } from '../storage-adapter';
import { IndexedDbAdapter } from './indexeddb-adapter';

/** Constructs `IndexedDbAdapter` through `TestBed` with `INDEXED_DB` overridden to `idb` — see the
 * class doc comment for why a plain `new IndexedDbAdapter(idb)` doesn't work. */
function createAdapter(idb: IDBFactory): StorageAdapter {
  TestBed.configureTestingModule({
    providers: [IndexedDbAdapter, { provide: INDEXED_DB, useValue: idb }],
  });
  return TestBed.inject(IndexedDbAdapter);
}

function sampleDoc(deviceId: string): RootDocument {
  return {
    schemaVersion: 1,
    meta: { createdAt: 't0', updatedAt: 't0', appVersion: '0.0.0', deviceId },
    profile: {},
    settings: {},
    shared: {},
    habits: {} as RootDocument['habits'],
    extras: {},
  };
}

/** Reads a raw key straight out of the fake database, bypassing `IndexedDbAdapter`, so tests can
 * check what actually landed in `backup-previous` without trusting the adapter's own `load()`. */
function readRawKey(idb: IDBFactory, key: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const openRequest = idb.open('sevenhabits');
    openRequest.onsuccess = () => {
      const db = openRequest.result;
      const tx = db.transaction('documents', 'readonly');
      const getRequest = tx.objectStore('documents').get(key);
      getRequest.onsuccess = () => resolve(getRequest.result);
      getRequest.onerror = () => reject(getRequest.error);
    };
    openRequest.onerror = () => reject(openRequest.error);
  });
}

describe('IndexedDbAdapter', () => {
  // Each test gets its own in-memory `IDBFactory` so the contract's "nothing saved yet" cases
  // never see data left over from another test.
  describeStorageAdapterContract(() => createAdapter(new IDBFactory()));

  it('reports its kind as indexeddb', () => {
    expect(createAdapter(new IDBFactory()).kind).toBe('indexeddb');
  });

  it('keeps the previous good version in backup-previous before overwriting current', async () => {
    const idb = new IDBFactory();
    const adapter = createAdapter(idb);
    const first = sampleDoc('device-1');
    const second = sampleDoc('device-2');

    await adapter.save(first, { reason: 'flush' });
    await adapter.save(second, { reason: 'flush' });

    await expect(adapter.load()).resolves.toEqual(second);
    await expect(readRawKey(idb, 'backup-previous')).resolves.toEqual(first);
  });

  it('does not write a backup on the very first save (nothing to back up yet)', async () => {
    const idb = new IDBFactory();
    const adapter = createAdapter(idb);

    await adapter.save(sampleDoc('device-1'), { reason: 'flush' });

    await expect(readRawKey(idb, 'backup-previous')).resolves.toBeUndefined();
  });

  it('clear() removes current but keeps backup-previous', async () => {
    const idb = new IDBFactory();
    const adapter = createAdapter(idb);
    await adapter.save(sampleDoc('device-1'), { reason: 'flush' });
    await adapter.save(sampleDoc('device-2'), { reason: 'flush' });

    await adapter.clear();

    await expect(readRawKey(idb, 'current')).resolves.toBeUndefined();
    await expect(readRawKey(idb, 'backup-previous')).resolves.toEqual(sampleDoc('device-1'));
  });

  it('the first save after clear() does not overwrite backup-previous', async () => {
    const idb = new IDBFactory();
    const adapter = createAdapter(idb);
    await adapter.save(sampleDoc('device-1'), { reason: 'flush' });
    await adapter.save(sampleDoc('device-2'), { reason: 'flush' });
    await adapter.clear();

    await adapter.save(sampleDoc('device-3'), { reason: 'flush' });

    await expect(readRawKey(idb, 'backup-previous')).resolves.toEqual(sampleDoc('device-1'));
  });

  it('reuses one database connection across calls instead of reopening it every time', async () => {
    const idb = new IDBFactory();
    const openSpy = vi.spyOn(idb, 'open');
    const adapter = createAdapter(idb);

    await adapter.save(sampleDoc('device-1'), { reason: 'flush' });
    await adapter.load();
    await adapter.save(sampleDoc('device-2'), { reason: 'flush' });

    expect(openSpy).toHaveBeenCalledTimes(1);
  });

  it('rejects load() and save() with the underlying error when opening the database fails', async () => {
    const openError = new Error('boom');
    const fakeIdb = {
      open: vi.fn(() => {
        const request = {
          onupgradeneeded: null,
          onsuccess: null,
          onerror: null as (() => void) | null,
          error: openError,
        };
        queueMicrotask(() => request.onerror?.());
        return request;
      }),
    } as unknown as IDBFactory;
    const adapter = createAdapter(fakeIdb);

    await expect(adapter.load()).rejects.toBe(openError);
    await expect(adapter.save(sampleDoc('device-1'), { reason: 'flush' })).rejects.toBe(openError);
  });

  it('does not cache a permanently failed database open: a later call tries again', async () => {
    const idb = new IDBFactory();
    // Pre-create the database at a higher version than the adapter ever requests, so the
    // adapter's own `open(DB_NAME, 1)` fails with a real IndexedDB version error every time.
    await new Promise<void>((resolve, reject) => {
      const request = idb.open('sevenhabits', 2);
      request.onupgradeneeded = () => request.result.createObjectStore('documents');
      request.onsuccess = () => {
        request.result.close();
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
    const openSpy = vi.spyOn(idb, 'open');
    const adapter = createAdapter(idb);

    await expect(adapter.load()).rejects.toBeTruthy();
    await expect(adapter.load()).rejects.toBeTruthy();

    expect(openSpy).toHaveBeenCalledTimes(2);
  });

  it('#139: reopens the database and succeeds after the connection is closed unexpectedly (onclose)', async () => {
    const idb = new IDBFactory();
    const openSpy = vi.spyOn(idb, 'open');
    const adapter = createAdapter(idb);

    await adapter.save(sampleDoc('device-1'), { reason: 'flush' });
    const db = (openSpy.mock.results[0]!.value as IDBOpenDBRequest).result;
    // Simulate the browser closing the connection on its own (storage evicted under pressure, a
    // profile-level wipe, ...): fire `close` the same way the real event would.
    (db.onclose as (() => void) | null)?.();

    await adapter.save(sampleDoc('device-2'), { reason: 'flush' });

    expect(openSpy).toHaveBeenCalledTimes(2);
    await expect(adapter.load()).resolves.toEqual(sampleDoc('device-2'));
  });

  it('#139: closes the connection and reports connectionSuperseded on versionchange', async () => {
    const idb = new IDBFactory();
    const openSpy = vi.spyOn(idb, 'open');
    const adapter = createAdapter(idb);
    const connectionSuperseded = () => (adapter as IndexedDbAdapter).connectionSuperseded();

    await adapter.save(sampleDoc('device-1'), { reason: 'flush' });
    const db = (openSpy.mock.results[0]!.value as IDBOpenDBRequest).result;
    const closeSpy = vi.spyOn(db, 'close');

    expect(connectionSuperseded()).toBe(0);
    // Simulate another tab opening a newer DB_VERSION: this connection must close so that open
    // can proceed, and report itself as superseded so the UI can tell the user to reload.
    (db.onversionchange as (() => void) | null)?.();

    expect(closeSpy).toHaveBeenCalledTimes(1);
    expect(connectionSuperseded()).toBe(1);

    // A later call reopens rather than reusing the closed connection.
    await adapter.load();
    expect(openSpy).toHaveBeenCalledTimes(2);
  });

  it('#139: a connection that closes after already being replaced does not clobber the new one', async () => {
    const idb = new IDBFactory();
    const openSpy = vi.spyOn(idb, 'open');
    const adapter = createAdapter(idb);

    await adapter.save(sampleDoc('device-1'), { reason: 'flush' });
    const firstDb = (openSpy.mock.results[0]!.value as IDBOpenDBRequest).result;
    (firstDb.onclose as (() => void) | null)?.();
    await adapter.save(sampleDoc('device-2'), { reason: 'flush' });
    expect(openSpy).toHaveBeenCalledTimes(2);

    // The first (already-replaced) connection belatedly fires its own close handler too.
    (firstDb.onclose as (() => void) | null)?.();

    await adapter.load();
    expect(openSpy).toHaveBeenCalledTimes(2);
  });

  it('#139: rejects instead of hanging when the open request is blocked', async () => {
    const fakeIdb = {
      open: vi.fn(() => {
        const request = {
          onupgradeneeded: null,
          onsuccess: null,
          onerror: null,
          onblocked: null as (() => void) | null,
        };
        queueMicrotask(() => request.onblocked?.());
        return request;
      }),
    } as unknown as IDBFactory;
    const adapter = createAdapter(fakeIdb);

    await expect(adapter.load()).rejects.toThrow(/blocked/i);
  });

  it('#139: closes a belated connection instead of leaking it when onsuccess fires after onblocked', async () => {
    const closeSpy = vi.fn();
    const db = { close: closeSpy, objectStoreNames: { contains: () => true } };
    interface FakeRequest {
      onupgradeneeded: (() => void) | null;
      onsuccess: (() => void) | null;
      onerror: (() => void) | null;
      onblocked: (() => void) | null;
      result: unknown;
    }
    const fakeIdb = {
      open: vi.fn(() => {
        const request: FakeRequest = {
          onupgradeneeded: null,
          onsuccess: null,
          onerror: null,
          onblocked: null,
          result: db,
        };
        queueMicrotask(() => {
          request.onblocked?.();
          // The blocking connection elsewhere closes afterwards; the spec still delivers a belated
          // success for this already-abandoned request.
          queueMicrotask(() => request.onsuccess?.());
        });
        return request;
      }),
    } as unknown as IDBFactory;
    const adapter = createAdapter(fakeIdb);

    await expect(adapter.load()).rejects.toThrow(/blocked/i);
    await Promise.resolve();
    await Promise.resolve();

    expect(closeSpy).toHaveBeenCalledTimes(1);
  });
});
