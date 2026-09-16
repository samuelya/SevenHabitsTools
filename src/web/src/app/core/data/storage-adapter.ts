import { InjectionToken } from '@angular/core';
import { RootDocument } from './document.model';

/** Why a save was triggered. Adapters may use it for logging, but must persist either way. */
export type SaveReason = 'debounce' | 'flush';

export interface SaveOptions {
  readonly reason: SaveReason;
}

export type StorageAdapterKind = 'noop' | 'indexeddb' | 'onedrive' | 'googledrive';

/**
 * Persists and loads the single `RootDocument`. Every implementation — `NoopAdapter` here, the
 * IndexedDB adapter (#35), OneDrive and Google Drive later — must satisfy
 * `describeStorageAdapterContract()` (`storage-adapter.contract.ts`) so the persistence effect
 * and bootstrap loader can treat them interchangeably.
 */
export interface StorageAdapter {
  readonly kind: StorageAdapterKind;
  /** Resolves the stored document, or `null` when nothing has been saved yet. */
  load(): Promise<RootDocument | null>;
  /** Persists `doc`, replacing whatever was stored before. */
  save(doc: RootDocument, options: SaveOptions): Promise<void>;
  /** Removes the current document, so a subsequent `load()` resolves to `null`. Any backup copy
   * the adapter keeps (e.g. IndexedDB's `backup-previous`) is left untouched: this is "Start
   * fresh", and the backup is how a user's last good data can still be recovered afterwards. */
  clear(): Promise<void>;
}

export const STORAGE_ADAPTER = new InjectionToken<StorageAdapter>('STORAGE_ADAPTER');

/**
 * Storage is temporarily unavailable because something else holds it — IndexedDB's `onblocked`
 * (another tab of an older build never closed its connection) today, a locked remote file later.
 * Part of the adapter contract rather than any one adapter's own error type, because callers have
 * to tell it apart from a genuinely unreadable document: the stored data is intact and retrying
 * once the blocker is gone succeeds, so nothing may offer corrupt-data recovery for it (#139).
 */
export class StorageBlockedError extends Error {
  constructor() {
    // The message is a Labels/Transloco key, not user-facing text, matching SchemaVersionTooNewError.
    super('data.bootstrap.storageBlocked');
    this.name = 'StorageBlockedError';
  }
}
