import { DOCUMENT } from '@angular/common';
import { Injectable, Injector, Signal, effect, inject, signal } from '@angular/core';
import { WINDOW } from '../browser/window';
import { CLOCK } from '../time/clock';
import { DocumentBootstrapStatus } from './document-bootstrap-status';
import { DocumentStore } from './document.store';
import { WRITER_LOCK } from './multi-tab/writer-lock';
import { SaveReason, STORAGE_ADAPTER } from './storage-adapter';

/** How long to wait after an edit before saving, so rapid changes coalesce into one write. */
export const SAVE_DEBOUNCE_MS = 500;

/** How long to wait before the first retry after `adapter.save()` rejects. */
export const SAVE_RETRY_MS = 5000;

/** The retry delay doubles on each consecutive failure, up to this cap. */
export const SAVE_RETRY_MAX_MS = 60000;

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
 * never dropped. A failed save is caught (never an unhandled rejection) and retried with
 * exponential backoff (`SAVE_RETRY_MS` doubling up to `SAVE_RETRY_MAX_MS`), reset to the initial
 * delay after the next successful save; the next edit or an explicit `flush()` also retries early.
 *
 * Saving is disabled while `DocumentBootstrapStatus` reports `corrupt`: the loaded document is
 * known to be invalid, so nothing here may overwrite what is actually stored until the user picks
 * export-raw or reset (`DataErrorPage`) and status returns to `ready`.
 *
 * Saving is disabled the same way while `WRITER_LOCK` reports this tab is not the writer (#35): a
 * read-only tab must never mark the document dirty (`scheduleSave()`) or call `adapter.save()`
 * (`runSaveLoop()`), including when `CrossTabSync` reloads its document out from under it — that
 * reload must not look like a local edit.
 *
 * This class never reacts to a tab *becoming* the writer on its own — deciding when a newly-writer
 * tab may trust its in-memory document enough to save it is the caller's job, not this generic
 * save loop's: an ordinary promotion (a confirmed reader whose writer tab closed) instead reloads
 * the page (`WriterPromotionReload`), since its in-memory document may be stale, while the
 * corrupt-recovery import (`DocumentImportExportService`, #150) explicitly waits for its own
 * `WRITER_LOCK` role to settle before ever calling `saveNow()`. A version of this class that
 * itself flushed on every writer-lock grant regressed exactly that distinction (#158): it also
 * fired on a genuine promotion, racing `WriterPromotionReload`'s reload with a save of a
 * possibly-stale document.
 */
@Injectable({ providedIn: 'root' })
export class DocumentPersistence {
  private readonly store = inject(DocumentStore);
  private readonly adapter = inject(STORAGE_ADAPTER);
  private readonly bootstrapStatus = inject(DocumentBootstrapStatus);
  private readonly writerLock = inject(WRITER_LOCK);
  private readonly document = inject(DOCUMENT);
  private readonly window = inject(WINDOW);
  private readonly injector = inject(Injector);
  private readonly clock = inject(CLOCK);

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
  private retryAttempt = 0;
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
    if (!this.writerLock.isWriter()) {
      // A read-only tab's document only ever changes because CrossTabSync just reloaded it from
      // the writer's save; that is not a local edit, so it must never be marked dirty.
      return;
    }
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

  /**
   * Saves the current document immediately, marking it dirty itself rather than waiting for the
   * `effect()` in `start()` to notice — for a caller that just replaced the whole document through
   * a non-edit path (`DocumentStore.replaceDocument`, e.g. a JSON import) and needs it durably
   * saved before returning, without depending on when Angular next runs that effect. Still subject
   * to the same corrupt/read-only gates as every other save (`runSaveLoop()`), so it is a safe
   * no-op if called from the wrong state.
   */
  async saveNow(): Promise<void> {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = undefined;
    clearTimeout(this.retryTimer);
    this.retryTimer = undefined;
    this.dirtySignal.set(true);
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
      if (this.bootstrapStatus.state() !== 'ready') {
        // Stay dirty: once the user resolves the corrupt document (export/reset), the resulting
        // document change re-triggers a save.
        return;
      }
      if (!this.writerLock.isWriter()) {
        // Defense in depth alongside the `scheduleSave()` gate above: a tab that lost the writer
        // lock while a save was already in flight must not let this loop save again.
        return;
      }
      const doc = this.store.document();
      try {
        await this.adapter.save(doc, { reason });
      } catch (error) {
        this.saveErrorSignal.set(error);
        const delay = Math.min(SAVE_RETRY_MS * 2 ** this.retryAttempt, SAVE_RETRY_MAX_MS);
        this.retryAttempt++;
        clearTimeout(this.retryTimer);
        this.retryTimer = setTimeout(() => void this.ensureSaving('debounce'), delay);
        return;
      }
      this.retryAttempt = 0;
      this.saveErrorSignal.set(null);
      this.lastSavedAtSignal.set(this.clock.now());
      if (this.store.document() === doc) {
        this.dirtySignal.set(false);
        return;
      }
      // A newer edit landed while this save was in flight; loop and save it too.
      reason = 'flush';
    }
  }
}
