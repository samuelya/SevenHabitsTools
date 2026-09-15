import { DOCUMENT } from '@angular/common';
import { Injectable, Injector, Signal, effect, inject, signal } from '@angular/core';
import { WINDOW } from '../browser/window';
import { DocumentStore } from './document.store';
import { SaveReason, STORAGE_ADAPTER } from './storage-adapter';

/** How long to wait after an edit before saving, so rapid changes coalesce into one write. */
export const SAVE_DEBOUNCE_MS = 500;

/**
 * Watches `DocumentStore.document` and saves it through the `StorageAdapter`: debounced after an
 * edit, flushed immediately when the tab is hidden or unloaded. Exposes `dirty`/`lastSavedAt` for
 * a UI status indicator. Loading, migration and the corrupt-data path are `document-bootstrap.ts`'s
 * job, not this service's — it only ever reacts to changes already in the store.
 */
@Injectable({ providedIn: 'root' })
export class DocumentPersistence {
  private readonly store = inject(DocumentStore);
  private readonly adapter = inject(STORAGE_ADAPTER);
  private readonly document = inject(DOCUMENT);
  private readonly window = inject(WINDOW);
  private readonly injector = inject(Injector);

  private readonly dirtySignal = signal(false);
  private readonly lastSavedAtSignal = signal<Date | null>(null);
  readonly dirty: Signal<boolean> = this.dirtySignal.asReadonly();
  readonly lastSavedAt: Signal<Date | null> = this.lastSavedAtSignal.asReadonly();

  private started = false;
  private isFirstRun = true;
  private debounceTimer: ReturnType<typeof setTimeout> | undefined;

  private readonly onVisibilityChange = (): void => {
    if (this.document.visibilityState === 'hidden') {
      void this.flush();
    }
  };

  private readonly onPageHide = (): void => {
    void this.flush();
  };

  /** Starts watching for changes. Call once, after the initial document has been loaded, so the
   * loaded document itself is never mistaken for an unsaved edit. */
  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;

    effect(
      () => {
        this.store.document();
        if (this.isFirstRun) {
          this.isFirstRun = false;
          return;
        }
        this.scheduleSave();
      },
      { injector: this.injector },
    );
    this.document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.window.addEventListener('pagehide', this.onPageHide);
  }

  private scheduleSave(): void {
    this.dirtySignal.set(true);
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => void this.save('debounce'), SAVE_DEBOUNCE_MS);
  }

  /** Saves immediately, cancelling any pending debounce timer. A no-op when there is nothing to save. */
  async flush(): Promise<void> {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = undefined;
    await this.save('flush');
  }

  private async save(reason: SaveReason): Promise<void> {
    if (!this.dirtySignal()) {
      return;
    }
    await this.adapter.save(this.store.document(), { reason });
    this.dirtySignal.set(false);
    this.lastSavedAtSignal.set(new Date());
  }
}
