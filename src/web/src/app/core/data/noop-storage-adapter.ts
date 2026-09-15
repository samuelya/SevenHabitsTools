import { Injectable } from '@angular/core';
import { RootDocument } from './document.model';
import { StorageAdapter } from './storage-adapter';

/**
 * In-memory `StorageAdapter`: keeps the document only for the lifetime of the instance. It is the
 * app's default until the IndexedDB adapter (#35) lands — swap `STORAGE_ADAPTER`'s provider in
 * `app.config.ts` when it does — and the reference implementation the contract spec runs against.
 */
@Injectable()
export class NoopAdapter implements StorageAdapter {
  readonly kind = 'noop';

  private stored: RootDocument | null = null;

  async load(): Promise<RootDocument | null> {
    return this.stored;
  }

  async save(doc: RootDocument): Promise<void> {
    this.stored = doc;
  }

  async clear(): Promise<void> {
    this.stored = null;
  }
}
