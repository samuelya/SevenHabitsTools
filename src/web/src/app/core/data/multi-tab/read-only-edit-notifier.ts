import { Injectable, Injector, effect, inject, untracked } from '@angular/core';
import { Labels } from '../../i18n/labels';
import { AppSnackbar } from '../../layout/app-snackbar';
import { DocumentStore } from '../document.store';
import { WRITER_LOCK } from './writer-lock';

/** How long the "edit refused" snackbar stays up; it also has a dismiss action. */
export const READ_ONLY_EDIT_SNACKBAR_MS = 6000;

/**
 * Tells the user when `DocumentStore` refused an edit because this tab isn't the writer (#127):
 * another tab holds the lock (`reader`), or this tab's lock request hasn't settled yet
 * (`pending`). The persistent `ReadOnlyBanner` already says the tab is read-only; this is the
 * immediate answer to "why didn't my change stick?".
 */
@Injectable({ providedIn: 'root' })
export class ReadOnlyEditNotifier {
  private readonly store = inject(DocumentStore);
  private readonly writerLock = inject(WRITER_LOCK);
  private readonly snackbar = inject(AppSnackbar);
  private readonly labels = inject(Labels);
  private readonly injector = inject(Injector);

  private started = false;

  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;

    let seen = untracked(this.store.refusedEdits);
    effect(
      () => {
        const refused = this.store.refusedEdits();
        if (refused > seen) {
          untracked(() => void this.showSnackbar());
        }
        seen = refused;
      },
      { injector: this.injector },
    );
  }

  private async showSnackbar(): Promise<void> {
    const key =
      this.writerLock.role() === 'pending'
        ? 'data.readOnly.editPending'
        : 'data.readOnly.editRefused';
    await this.snackbar.open(this.labels.text(key), this.labels.text('data.snackbar.dismiss'), {
      duration: READ_ONLY_EDIT_SNACKBAR_MS,
    });
  }
}
