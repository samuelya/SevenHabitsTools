import { IDBFactory } from 'fake-indexeddb';
import { describeStorageAdapterContract } from '../storage-adapter.contract';
import { RootDocument } from '../document.model';
import { StorageAdapter } from '../storage-adapter';
import { IndexedDbAdapter } from './indexeddb-adapter';

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
  describeStorageAdapterContract(() => new IndexedDbAdapter(new IDBFactory()));

  it('reports its kind as indexeddb', () => {
    expect(new IndexedDbAdapter(new IDBFactory()).kind).toBe('indexeddb');
  });

  it('keeps the previous good version in backup-previous before overwriting current', async () => {
    const idb = new IDBFactory();
    const adapter: StorageAdapter = new IndexedDbAdapter(idb);
    const first = sampleDoc('device-1');
    const second = sampleDoc('device-2');

    await adapter.save(first, { reason: 'flush' });
    await adapter.save(second, { reason: 'flush' });

    await expect(adapter.load()).resolves.toEqual(second);
    await expect(readRawKey(idb, 'backup-previous')).resolves.toEqual(first);
  });

  it('does not write a backup on the very first save (nothing to back up yet)', async () => {
    const idb = new IDBFactory();
    const adapter: StorageAdapter = new IndexedDbAdapter(idb);

    await adapter.save(sampleDoc('device-1'), { reason: 'flush' });

    await expect(readRawKey(idb, 'backup-previous')).resolves.toBeUndefined();
  });

  it('clears both current and backup-previous', async () => {
    const idb = new IDBFactory();
    const adapter: StorageAdapter = new IndexedDbAdapter(idb);
    await adapter.save(sampleDoc('device-1'), { reason: 'flush' });
    await adapter.save(sampleDoc('device-2'), { reason: 'flush' });

    await adapter.clear();

    await expect(readRawKey(idb, 'current')).resolves.toBeUndefined();
    await expect(readRawKey(idb, 'backup-previous')).resolves.toBeUndefined();
  });

  it('reuses one database connection across calls instead of reopening it every time', async () => {
    const idb = new IDBFactory();
    const openSpy = vi.spyOn(idb, 'open');
    const adapter: StorageAdapter = new IndexedDbAdapter(idb);

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
    const adapter: StorageAdapter = new IndexedDbAdapter(fakeIdb);

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
    const adapter: StorageAdapter = new IndexedDbAdapter(idb);
    const openSpy = vi.spyOn(idb, 'open');

    await expect(adapter.load()).rejects.toBeTruthy();
    await expect(adapter.load()).rejects.toBeTruthy();

    expect(openSpy).toHaveBeenCalledTimes(2);
  });
});
