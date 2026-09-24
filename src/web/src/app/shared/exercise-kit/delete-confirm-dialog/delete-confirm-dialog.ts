import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  inject,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { TranslocoPipe } from '@jsverse/transloco';

/** Optional wording for a delete that isn't a whole entry (e.g. one area of an assessment, #222
 * re-review R6), already translated by the caller; each one left out keeps the generic copy. */
export interface DeleteConfirmDialogData {
  readonly title?: string;
  readonly body?: string;
  readonly confirmLabel?: string;
}

/**
 * The one confirm-delete dialog every exercise's bin button and swipe-to-delete share (issue
 * #203's "shared pattern"): destructive styling on Delete, Cancel focused first, Escape/backdrop
 * both cancel (Angular Material's own default — no extra wiring needed here). It carries no
 * per-feature data: the trigger's own aria-label ("Delete <date/title>", `ExerciseList`'s and
 * `AssessmentHistoryList`'s bin button) already told the user which item, so this dialog's own
 * copy is generic by default (a caller may override it through `DeleteConfirmDialogData`), from the root i18n scope (`deleteConfirm.*`) — the same
 * root-scope-not-feature-scope choice `ImportConfirmDialog` makes, since `AppDialog.open()` opens
 * this from the root environment injector, not the calling route's own Transloco scope.
 *
 * `DeleteWithUndo` (`../delete-with-undo.ts`) is the only caller: it lazy-loads this component,
 * same as `BackupSection` lazy-loads `ImportConfirmDialog`, so this dialog's code isn't in any
 * page's initial bundle.
 */
@Component({
  selector: 'app-delete-confirm-dialog',
  imports: [
    MatButtonModule,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    MatDialogTitle,
    TranslocoPipe,
  ],
  templateUrl: './delete-confirm-dialog.html',
  styleUrl: './delete-confirm-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeleteConfirmDialog {
  private readonly dialogRef = inject(MatDialogRef<DeleteConfirmDialog, boolean>);
  protected readonly data: DeleteConfirmDialogData =
    inject<DeleteConfirmDialogData | null>(MAT_DIALOG_DATA, { optional: true }) ?? {};

  private readonly cancelButton = viewChild<HTMLButtonElement>('cancelButton');

  constructor() {
    // Cancel focused by default (issue #203's acceptance criteria), the same "move focus to the
    // safe option as soon as the destructive step appears" reasoning as `ImportConfirmDialog`'s
    // replace confirmation — here there's no earlier step to react to, so a one-shot
    // `afterNextRender` after the dialog's first paint does it, rather than an `effect()` gated on
    // a signal this dialog doesn't have.
    afterNextRender(() => this.cancelButton()?.focus());
  }

  protected confirmDelete(): void {
    this.dialogRef.close(true);
  }
}
