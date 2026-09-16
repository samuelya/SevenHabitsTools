import { Injectable, Injector, effect, inject, untracked } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { FileDownloader } from '../../browser/file-download';
import { WINDOW } from '../../browser/window';
import { AppSnackbar } from '../../layout/app-snackbar';
import { DocumentPersistence } from '../document-persistence';
import { DocumentStore } from '../document.store';
import { SaveErrorNotifier } from '../save-error-notifier';
import { IndexedDbAdapter } from './indexeddb-adapter';

/**
 * Tells the user to reload once another tab has opened a newer IndexedDB `DB_VERSION`
 * (`IndexedDbAdapter.connectionSuperseded`, from `onversionchange`, #139): this tab's connection is
 * already closed and can never reopen at its own, now-stale version, so it would otherwise keep
 * running against a document it can no longer save.
 *
 * That supersession is terminal, which is why this deliberately does *not* copy
 * `AppUpdateService`'s "flush, and reopen the prompt while the document is still unsaved" guard: a
 * service-worker update can wait for a save that will eventually land, whereas here no save can
 * ever succeed again, so the same guard would reopen the prompt forever and the user could never
 * reload at all. Instead the reload is attempted once (`flush()` first, in case the edit still
 * belongs to a connection that did save) and, if anything is left unsaved, the user is told the
 * truth — this tab cannot save any more — and offered a JSON backup download before reloading, so
 * nothing is silently discarded and nothing blocks forever.
 *
 * `IndexedDbAdapter` is injected optionally: `DocumentSync` (which starts this alongside every
 * other document-dependent service) must stay usable with any `StorageAdapter`, not just this one,
 * so a run without a real `IndexedDbAdapter` in the injector — a test, or a future adapter kind —
 * simply has nothing to watch instead of failing to construct.
 */
@Injectable({ providedIn: 'root' })
export class IndexedDbUpgradeNotifier {
  private readonly adapter = inject(IndexedDbAdapter, { optional: true });
  private readonly persistence = inject(DocumentPersistence);
  private readonly saveErrors = inject(SaveErrorNotifier);
  private readonly store = inject(DocumentStore);
  private readonly downloader = inject(FileDownloader);
  private readonly window = inject(WINDOW);
  private readonly snackbar = inject(AppSnackbar);
  private readonly transloco = inject(TranslocoService);
  private readonly injector = inject(Injector);

  private started = false;
  private promptOpen = false;
  private promptCount = 0;

  start(): void {
    if (this.started || !this.adapter) {
      return;
    }
    this.started = true;
    const adapter = this.adapter;

    let seen = untracked(adapter.connectionSuperseded);
    effect(
      () => {
        const count = adapter.connectionSuperseded();
        if (count > seen) {
          untracked(() => this.notify());
        }
        seen = count;
      },
      { injector: this.injector },
    );
  }

  /** Opens the reload prompt unless one of this service's prompts is already on screen — a second
   * superseded connection is the same news about the same tab, not a second thing to tell. */
  private notify(): void {
    // Every save from here on fails, and `SaveErrorNotifier` would reopen its snackbar over this
    // flow's — only one shows at a time — leaving the user on a generic save error with no way
    // back to the reload this tab actually needs.
    this.saveErrors.suppress();
    if (this.promptOpen) {
      return;
    }
    void this.showPrompt('data.indexedDb.reloadRequired', 'data.pwa.reload', () => {
      void this.onReloadClicked();
    });
  }

  private async onReloadClicked(): Promise<void> {
    await this.persistence.flush();
    if (this.persistence.dirty() || this.persistence.saveError() !== null) {
      void this.showExportPrompt();
      return;
    }
    this.window.location.reload();
  }

  /** The unsaved-and-unsavable path: offer the backup download, since reloading would drop the
   * edit and no retry here can ever write it to the superseded database. */
  private showExportPrompt(): Promise<void> {
    return this.showPrompt('data.indexedDb.unsavedBeforeReload', 'data.indexedDb.exportNow', () => {
      this.downloader.download(
        'seven-habits-tools-backup.json',
        JSON.stringify(this.store.document(), null, 2),
      );
      // Reloading straight after the download could interrupt it, so confirm the safe data and
      // let the user reload when their file has arrived.
      void this.showPrompt('data.indexedDb.exported', 'data.pwa.reload', () =>
        this.window.location.reload(),
      );
    });
  }

  private async showPrompt(
    messageKey: string,
    actionKey: string,
    onAction: () => void,
  ): Promise<void> {
    this.promptOpen = true;
    const id = ++this.promptCount;
    // Only the most recently opened prompt may clear the flag: the snackbar a step of this flow
    // replaces reports its dismissal after the replacement has already opened.
    const close = (): void => {
      if (id === this.promptCount) {
        this.promptOpen = false;
      }
    };
    try {
      const ref = await this.snackbar.open(
        this.transloco.translate(messageKey),
        this.transloco.translate(actionKey),
      );
      ref.onAction().subscribe(onAction);
      ref.afterDismissed().subscribe(close);
    } catch {
      // Couldn't open it (e.g. the snackbar code failed to load): this tab is still superseded,
      // but there's nothing more to do until the user reloads it some other way.
      close();
    }
  }
}
