import { Injectable, Injector, effect, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FileDownloader } from '../browser/file-download';
import { Labels } from '../i18n/labels';
import { DocumentPersistence } from './document-persistence';
import { DocumentStore } from './document.store';

/**
 * Shows a snackbar with an "export now" action whenever `DocumentPersistence.saveError` reports a
 * failed save, so a quota error or the browser otherwise refusing to write never fails silently.
 * `DocumentPersistence` itself keeps retrying; this class's only job is telling the user and
 * offering a way to get their data out while that keeps happening.
 */
@Injectable({ providedIn: 'root' })
export class SaveErrorNotifier {
  private readonly persistence = inject(DocumentPersistence);
  private readonly store = inject(DocumentStore);
  private readonly snackBar = inject(MatSnackBar);
  private readonly downloader = inject(FileDownloader);
  private readonly labels = inject(Labels);
  private readonly injector = inject(Injector);

  private started = false;

  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;

    effect(
      () => {
        if (this.persistence.saveError() !== null) {
          this.showSnackbar();
        }
      },
      { injector: this.injector },
    );
  }

  private showSnackbar(): void {
    const ref = this.snackBar.open(
      this.labels.text('data.saveError.message'),
      this.labels.text('data.saveError.exportNow'),
      { duration: undefined },
    );
    ref.onAction().subscribe(() => this.exportNow());
  }

  private exportNow(): void {
    this.downloader.download(
      'seven-habits-tools-backup.json',
      JSON.stringify(this.store.document(), null, 2),
    );
  }
}
