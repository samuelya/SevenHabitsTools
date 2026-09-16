import { Injectable, Injector, effect, inject, untracked } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import type { MatSnackBarRef } from '@angular/material/snack-bar';
import { FileDownloader } from '../browser/file-download';
import { AppSnackbar } from '../layout/app-snackbar';
import { DocumentPersistence } from './document-persistence';
import { RootDocument } from './document.model';
import { DocumentStore } from './document.store';
import { shouldShowSaveError } from './save-error-notifier.logic';
import type { SaveErrorSnackbarData } from './save-error-snackbar';
import { StrandedEditsError } from './stranded-edits-error';

const loadSaveErrorSnackbar = () => import('./save-error-snackbar');

/**
 * Shows a snackbar with "Export now" and "Dismiss" when `DocumentPersistence.saveError` reports a
 * failed save, so a quota error or the browser otherwise refusing to write never fails silently.
 * `DocumentPersistence` itself keeps retrying; this class's only job is telling the user and
 * offering a way to get their data out. When to (re)open is `shouldShowSaveError()`: not on every
 * retry (#128), but again once edits made after the user closed it fail to save too (#136).
 */
@Injectable({ providedIn: 'root' })
export class SaveErrorNotifier {
  private readonly persistence = inject(DocumentPersistence);
  private readonly store = inject(DocumentStore);
  private readonly snackbar = inject(AppSnackbar);
  private readonly downloader = inject(FileDownloader);
  private readonly transloco = inject(TranslocoService);
  private readonly injector = inject(Injector);

  private started = false;
  private open = false;
  private suppressed = false;
  private acknowledged: RootDocument | null = null;
  private ref: MatSnackBarRef<unknown> | undefined;

  /**
   * Stops this snackbar for good, for a tab that already knows *why* saving is over and is saying
   * so itself (`IndexedDbUpgradeNotifier`'s reload prompt, #139). Only one snackbar shows at a
   * time, so a later failed save reopening this one would replace that prompt — the user's only
   * route out of a tab that can no longer save — with a message offering nothing but an export.
   */
  suppress(): void {
    this.suppressed = true;
  }

  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    // Fetch the lazy snackbar code now, while the network is (most likely) still there.
    this.snackbar.preload();
    loadSaveErrorSnackbar().catch(() => undefined);

    effect(
      () => {
        const error = this.persistence.saveError();
        untracked(() => this.onSaveResult(error));
      },
      { injector: this.injector },
    );
  }

  private onSaveResult(error: unknown): void {
    if (this.suppressed) {
      return;
    }
    if (error === null) {
      // A save succeeded: this run of failures is over. Dismiss a snackbar left over from it, so
      // it stops claiming saves are failing; the next failure opens a fresh one.
      this.acknowledged = null;
      if (this.open) {
        this.open = false;
        this.ref?.dismiss();
        this.ref = undefined;
      }
      return;
    }
    const current = this.store.document();
    if (shouldShowSaveError({ open: this.open, acknowledged: this.acknowledged, current })) {
      void this.showSnackbar(error);
    }
  }

  private async showSnackbar(error: unknown): Promise<void> {
    this.open = true;
    try {
      const { SaveErrorSnackbar } = await loadSaveErrorSnackbar();
      const messageKey =
        error instanceof StrandedEditsError
          ? 'data.saveError.strandedMessage'
          : 'data.saveError.message';
      const data: SaveErrorSnackbarData = {
        message: this.transloco.translate(messageKey),
        exportLabel: this.transloco.translate('data.saveError.exportNow'),
        dismissLabel: this.transloco.translate('data.snackbar.dismiss'),
      };
      const ref = await this.snackbar.openFromComponent(SaveErrorSnackbar, { data });
      if (!this.open) {
        // The save succeeded (dismissing this run) while the snackbar code was still loading.
        ref.dismiss();
        return;
      }
      this.ref = ref;
      ref.onAction().subscribe(() => this.exportNow());
      ref.afterDismissed().subscribe(() => {
        // A dismiss's async exit animation can outlive this ref: a success (onSaveResult) or a
        // new failure (showSnackbar) may already have replaced `this.ref` by the time this fires.
        // Only reset state for the ref that's still current, so a stale callback can't clobber it.
        if (this.ref === ref) {
          this.onClosed();
        }
      });
    } catch {
      // Couldn't open it (e.g. the snackbar code failed to load): let the next failure try again.
      this.open = false;
    }
  }

  private onClosed(): void {
    this.open = false;
    this.ref = undefined;
    // Only edits made from here on should reopen it while saves keep failing (#136).
    this.acknowledged = this.persistence.saveError() !== null ? this.store.document() : null;
  }

  private exportNow(): void {
    this.downloader.download(
      'seven-habits-tools-backup.json',
      JSON.stringify(this.store.document(), null, 2),
    );
  }
}
