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
  /** Removes the stored document; a subsequent `load()` resolves to `null`. */
  clear(): Promise<void>;
}

export const STORAGE_ADAPTER = new InjectionToken<StorageAdapter>('STORAGE_ADAPTER');
