import { Injectable, Injector, effect, inject, untracked } from '@angular/core';
import { FileDownloader } from '../browser/file-download';
import { Labels } from '../i18n/labels';
import { AppSnackbar } from '../layout/app-snackbar';
import { DocumentPersistence } from './document-persistence';
import { DocumentStore } from './document.store';
import type { SaveErrorSnackbarData } from './save-error-snackbar';

/**
 * Shows a snackbar with "Export now" and "Dismiss" when `DocumentPersistence.saveError` reports a
 * failed save, so a quota error or the browser otherwise refusing to write never fails silently.
 * `DocumentPersistence` itself keeps retrying; this class's only job is telling the user and
 * offering a way to get their data out. It opens once per run of failures, not on every retry
 * (#128): a successful save ends the run, and the next failure opens it again.
 */
@Injectable({ providedIn: 'root' })
export class SaveErrorNotifier {
  private readonly persistence = inject(DocumentPersistence);
  private readonly store = inject(DocumentStore);
  private readonly snackbar = inject(AppSnackbar);
  private readonly downloader = inject(FileDownloader);
  private readonly labels = inject(Labels);
  private readonly injector = inject(Injector);

  private started = false;
  private failing = false;

  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;

    effect(
      () => {
        const failing = this.persistence.saveError() !== null;
        if (failing && !this.failing) {
          untracked(() => void this.showSnackbar());
        }
        this.failing = failing;
      },
      { injector: this.injector },
    );
  }

  private async showSnackbar(): Promise<void> {
    // Loaded with the snackbar itself, only once a save has actually failed.
    const { SaveErrorSnackbar } = await import('./save-error-snackbar');
    const data: SaveErrorSnackbarData = {
      message: this.labels.text('data.saveError.message'),
      exportLabel: this.labels.text('data.saveError.exportNow'),
      dismissLabel: this.labels.text('data.snackbar.dismiss'),
    };
    const ref = await this.snackbar.openFromComponent(SaveErrorSnackbar, { data });
    ref.onAction().subscribe(() => this.exportNow());
  }

  private exportNow(): void {
    this.downloader.download(
      'seven-habits-tools-backup.json',
      JSON.stringify(this.store.document(), null, 2),
    );
  }
}
