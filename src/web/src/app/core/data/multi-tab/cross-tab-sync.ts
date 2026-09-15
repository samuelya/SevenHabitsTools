import { Injectable, Injector, effect, inject } from '@angular/core';
import { BROADCAST_CHANNEL_FACTORY } from '../../browser/broadcast-channel';
import { DocumentPersistence } from '../document-persistence';
import { DocumentStore } from '../document.store';
import { STORAGE_ADAPTER } from '../storage-adapter';
import { WRITER_LOCK } from './writer-lock';

const CHANNEL_NAME = 'sevenhabits-sync';

/**
 * Keeps every tab's in-memory document fresh after another tab saves: the writer broadcasts once
 * a save completes, and every other tab reloads the document from the `StorageAdapter`. Only the
 * writer ever actually saves (`DocumentPersistence` refuses to for a read-only tab), so this class
 * only needs to decide whether an incoming broadcast is for *this* tab to act on — never whether
 * to send one, which follows automatically from watching `DocumentPersistence.lastSavedAt`.
 */
@Injectable({ providedIn: 'root' })
export class CrossTabSync {
  private readonly persistence = inject(DocumentPersistence);
  private readonly store = inject(DocumentStore);
  private readonly adapter = inject(STORAGE_ADAPTER);
  private readonly writerLock = inject(WRITER_LOCK);
  private readonly createChannel = inject(BROADCAST_CHANNEL_FACTORY);
  private readonly injector = inject(Injector);

  private started = false;
  private isFirstRun = true;

  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;

    const channel = this.createChannel(CHANNEL_NAME);
    if (!channel) {
      // No BroadcastChannel support: tabs simply don't cross-notify each other.
      return;
    }

    channel.onmessage = () => {
      if (!this.writerLock.isWriter()) {
        void this.reloadFromAdapter();
      }
    };

    effect(
      () => {
        const savedAt = this.persistence.lastSavedAt();
        if (this.isFirstRun) {
          this.isFirstRun = false;
          return;
        }
        if (savedAt !== null) {
          channel.postMessage({ type: 'saved' });
        }
      },
      { injector: this.injector },
    );
  }

  private async reloadFromAdapter(): Promise<void> {
    const doc = await this.adapter.load();
    if (doc !== null) {
      this.store.replaceDocument(doc);
    }
  }
}
