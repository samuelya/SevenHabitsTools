import { Injectable, inject } from '@angular/core';
import { INDEXED_DB } from '../../browser/indexed-db';
import { RootDocument } from '../document.model';
import { StorageAdapter } from '../storage-adapter';

const DB_NAME = 'sevenhabits';
const DB_VERSION = 1;
const STORE_NAME = 'documents';
const CURRENT_KEY = 'current';
const BACKUP_KEY = 'backup-previous';

/**
 * `StorageAdapter` backed by IndexedDB: database `sevenhabits`, object store `documents`. `save()`
 * writes the previous `current` value to `backup-previous` and the new document to `current` in a
 * single read-write transaction, so a failed or interrupted write can never leave `current`
 * half-written — either the whole transaction commits or none of it does. `clear()` ("Start fresh")
 * removes only `current`: `backup-previous` is the last good copy before a corrupt document and
 * must survive the reset. This is the only thing
 * this class does; multi-tab coordination is `WriterLockService` and `CrossTabSync`'s job, not
 * this adapter's.
 *
 * Every call is queued onto a private promise chain so overlapping `load`/`save`/`clear` calls run
 * one at a time, in call order — the `StorageAdapter` contract's "the later call wins" — rather
 * than relying on IndexedDB's own same-store transaction ordering, which not every fake
 * implementation reproduces exactly.
 *
 * Takes `INDEXED_DB` through a field-initializer `inject()` (not a constructor parameter): a
 * constructor parameter typed `IDBFactory` makes Angular's compiler inject *by that type* instead
 * of respecting an `inject(INDEXED_DB)` default, since `IDBFactory` also happens to be a real
 * global class — it fails at either build time (`NG2003`, with no type annotation to infer from)
 * or, worse, silently at runtime (`NG0201: No provider found for IDBFactory`, with one). Tests
 * construct this through `TestBed` with `INDEXED_DB` overridden, the same way every other adapter
 * or service in this codebase is tested, rather than `new`-ing it directly.
 */
@Injectable()
export class IndexedDbAdapter implements StorageAdapter {
  readonly kind = 'indexeddb';

  private readonly idb = inject(INDEXED_DB) as IDBFactory;
  private dbPromise: Promise<IDBDatabase> | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  async load(): Promise<RootDocument | null> {
    return this.enqueue(async () => {
      const db = await this.openDb();
      const value = await this.request<RootDocument | undefined>(
        (store) => store.get(CURRENT_KEY),
        db,
      );
      return value ?? null;
    });
  }

  async save(doc: RootDocument): Promise<void> {
    return this.enqueue(async () => {
      const db = await this.openDb();
      await this.writeCurrentAndBackup(db, doc);
    });
  }

  async clear(): Promise<void> {
    return this.enqueue(async () => {
      const db = await this.openDb();
      await this.runTransaction(db, 'readwrite', (store) => {
        store.delete(CURRENT_KEY);
      });
    });
  }

  /** Runs `task` after every previously enqueued task has settled, so calls made without waiting
   * for one another still execute — and complete — in the order they were made. */
  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const result = this.queue.then(task, task);
    this.queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private openDb(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
        const request = this.idb.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains(STORE_NAME)) {
            request.result.createObjectStore(STORE_NAME);
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
      }).catch((error: unknown) => {
        // Don't cache a permanent failure: a later call (e.g. DocumentPersistence's retry) should
        // try opening the database again instead of forever replaying today's error.
        this.dbPromise = null;
        throw error;
      });
    }
    return this.dbPromise;
  }

  private request<T>(run: (store: IDBObjectStore) => IDBRequest<T>, db: IDBDatabase): Promise<T> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = run(tx.objectStore(STORE_NAME));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
    });
  }

  private runTransaction(
    db: IDBDatabase,
    mode: IDBTransactionMode,
    run: (store: IDBObjectStore) => void,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, mode);
      run(tx.objectStore(STORE_NAME));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
    });
  }

  private writeCurrentAndBackup(db: IDBDatabase, doc: RootDocument): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const readCurrent = store.get(CURRENT_KEY);
      readCurrent.onsuccess = () => {
        if (readCurrent.result !== undefined) {
          store.put(readCurrent.result, BACKUP_KEY);
        }
        store.put(doc, CURRENT_KEY);
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
    });
  }
}
