import { DOCUMENT } from '@angular/common';
import { Injectable, Injector, Signal, effect, inject, signal } from '@angular/core';
import { WINDOW } from '../browser/window';
import { DocumentStore } from './document.store';
import { SaveReason, STORAGE_ADAPTER } from './storage-adapter';

/** How long to wait after an edit before saving, so rapid changes coalesce into one write. */
export const SAVE_DEBOUNCE_MS = 500;

/** How long to wait before retrying after `adapter.save()` rejects. */
export const SAVE_RETRY_MS = 5000;

/**
 * Watches `DocumentStore.document` and saves it through the `StorageAdapter`: debounced after an
 * edit, flushed immediately when the tab is hidden or unloaded. Exposes `dirty`/`lastSavedAt`/
 * `saveError` for a UI status indicator. Loading, migration and the corrupt-data path are
 * `document-bootstrap.ts`'s job, not this service's — it only ever reacts to changes already in
 * the store.
 *
 * A single save loop (`runSaveLoop`) is shared by the debounce timer and `flush()`: only one
 * `adapter.save()` call is ever in flight, and if the document changes again while a save is
 * running, the loop saves the newer document before clearing `dirty` — an edit made mid-save is
 * never dropped. A failed save is caught (never an unhandled rejection) and retried.
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
  private readonly saveErrorSignal = signal<unknown>(null);
  readonly dirty: Signal<boolean> = this.dirtySignal.asReadonly();
  readonly lastSavedAt: Signal<Date | null> = this.lastSavedAtSignal.asReadonly();
  /** The error from the most recent failed save, or `null` once a save has since succeeded. */
  readonly saveError: Signal<unknown> = this.saveErrorSignal.asReadonly();

  private started = false;
  private isFirstRun = true;
  private debounceTimer: ReturnType<typeof setTimeout> | undefined;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private saveLoop: Promise<void> | null = null;

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
    this.debounceTimer = setTimeout(() => void this.ensureSaving('debounce'), SAVE_DEBOUNCE_MS);
  }

  /** Saves immediately, cancelling any pending debounce timer. A no-op when there is nothing to save. */
  async flush(): Promise<void> {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = undefined;
    clearTimeout(this.retryTimer);
    this.retryTimer = undefined;
    await this.ensureSaving('flush');
  }

  /** Starts the save loop if nothing is already saving; returns the (possibly shared) in-flight promise. */
  private ensureSaving(reason: SaveReason): Promise<void> {
    if (!this.dirtySignal()) {
      return Promise.resolve();
    }
    if (!this.saveLoop) {
      this.saveLoop = this.runSaveLoop(reason).finally(() => {
        this.saveLoop = null;
      });
    }
    return this.saveLoop;
  }

  /** Saves `store.document()` and, if it changed again while that save was in flight, saves the
   * newer document too — repeating until the saved document is the current one. */
  private async runSaveLoop(reason: SaveReason): Promise<void> {
    for (;;) {
      const doc = this.store.document();
      try {
        await this.adapter.save(doc, { reason });
      } catch (error) {
        this.saveErrorSignal.set(error);
        clearTimeout(this.retryTimer);
        this.retryTimer = setTimeout(() => void this.ensureSaving('debounce'), SAVE_RETRY_MS);
        return;
      }
      this.saveErrorSignal.set(null);
      this.lastSavedAtSignal.set(new Date());
      if (this.store.document() === doc) {
        this.dirtySignal.set(false);
        return;
      }
      // A newer edit landed while this save was in flight; loop and save it too.
      reason = 'flush';
    }
  }
}
