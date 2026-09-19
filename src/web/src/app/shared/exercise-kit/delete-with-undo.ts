import { Injectable, InjectionToken, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { AppDialog } from '../../core/layout/app-dialog';
import { AppSnackbar } from '../../core/layout/app-snackbar';

type DeleteConfirmDialogModule = typeof import('./delete-confirm-dialog/delete-confirm-dialog');

/** DI seam around the lazy `import('./delete-confirm-dialog/delete-confirm-dialog')`, the same
 * shape `IMPORT_CONFIRM_DIALOG_LOADER` (`features/settings/backup/backup-section.ts`) uses — lets
 * a spec substitute or fail the load through a TestBed provider instead of module-level mocking,
 * which the Angular unit-test builder doesn't support for relative imports. */
export const DELETE_CONFIRM_DIALOG_LOADER = new InjectionToken<
  () => Promise<DeleteConfirmDialogModule>
>('DELETE_CONFIRM_DIALOG_LOADER', {
  providedIn: 'root',
  factory: () => () => import('./delete-confirm-dialog/delete-confirm-dialog'),
});

/** How long the "Deleted — Undo" snackbar stays up before Undo stops working — the same duration
 * `paradigms-transition` used before this issue (#187's `DELETE_UNDO_MS`), now shared. */
export const DELETE_UNDO_MS = 5000;

export interface ConfirmAndDeleteOptions {
  /** Already-translated, from the deleting feature's own scope (e.g. `paradigmsTransition.list
   * .deleted`) — this service has no scope of its own to translate from. */
  readonly deletedMessage: string;
  readonly undoLabel: string;
  /** Performs the tombstone (`store.update((items) => removeX(items, id, now))`); called only
   * once the user confirms. */
  readonly onConfirm: () => void;
  /** Performs the restore (`store.update((items) => restoreX(items, id, now))`); called only if
   * Undo is tapped before the snackbar times out. */
  readonly onUndo: () => void;
}

/**
 * The confirm → delete → undo flow every exercise's bin button and swipe-to-delete share (issue
 * #203): opens the one shared `DeleteConfirmDialog`, and only on an explicit "Delete" runs
 * `onConfirm()` and offers Undo through a snackbar. A page's delete handler is just this call plus
 * its own `removeX()`/`restoreX()` pair (`<slug>.logic.ts`) — the playbook's "Deleting entries"
 * section is the pattern every list/assessment exercise's page wires the same way.
 */
@Injectable({ providedIn: 'root' })
export class DeleteWithUndo {
  private readonly dialog = inject(AppDialog);
  private readonly snackbar = inject(AppSnackbar);
  private readonly transloco = inject(TranslocoService);
  private readonly loadDialogComponent = inject(DELETE_CONFIRM_DIALOG_LOADER);

  async confirmAndDelete(options: ConfirmAndDeleteOptions): Promise<void> {
    let dialogModule: DeleteConfirmDialogModule;
    try {
      dialogModule = await this.loadDialogComponent();
    } catch {
      // Most likely offline with this chunk not yet cached (the service worker's `chunks` group is
      // `installMode: lazy`) — say so plainly rather than the bin button/swipe silently doing
      // nothing, the same handling `BackupSection` gives its own lazy-loaded import dialog (review
      // finding on #204's PR).
      await this.snackbar.open(
        this.transloco.translate('deleteConfirm.dialogLoadError'),
        this.transloco.translate('data.snackbar.dismiss'),
      );
      return;
    }
    const { DeleteConfirmDialog } = dialogModule;
    const ref = await this.dialog.open<InstanceType<typeof DeleteConfirmDialog>, unknown, boolean>(
      DeleteConfirmDialog,
    );
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) {
      return;
    }
    options.onConfirm();
    const snackRef = await this.snackbar.open(options.deletedMessage, options.undoLabel, {
      duration: DELETE_UNDO_MS,
    });
    snackRef.onAction().subscribe(() => options.onUndo());
  }
}
