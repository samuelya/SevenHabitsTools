import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
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
import { ImportPreview } from '../../../core/data/backup/import-preview.logic';

export interface ImportConfirmDialogData {
  readonly preview: ImportPreview;
  readonly currentUpdatedAt: string;
}

/** What the user chose: replace the whole document, export the current document first (the
 * opener re-opens this dialog afterwards), or cancel (`undefined`, the dialog closed with no
 * explicit choice). Merge is deferred to Cloud Sync (#45) — see the removed `core/data/merge.ts`
 * at commit 2e4c62b and the design notes on #45. */
export type ImportConfirmDialogResult = 'replace' | 'export-first' | undefined;

/**
 * Confirms a JSON import: previews the imported file's per-feature counts and last-edited time
 * next to the current document's, and lets the user export the current document first before
 * Replacing — a second, explicit confirmation step, mirroring `DataErrorPage`'s "Start fresh",
 * since it discards whatever is currently on this device. Purely presentational plus one narrow
 * side action (export); it never touches the document store itself — `BackupSection` (the opener)
 * applies whatever the user chose.
 */
@Component({
  selector: 'app-import-confirm-dialog',
  imports: [
    MatButtonModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    DatePipe,
    TranslocoPipe,
  ],
  templateUrl: './import-confirm-dialog.html',
  styleUrl: './import-confirm-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImportConfirmDialog {
  protected readonly data = inject<ImportConfirmDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<ImportConfirmDialog, ImportConfirmDialogResult>);

  protected readonly confirmingReplace = signal(false);
  protected readonly hasCounts = computed(() => this.data.preview.counts.length > 0);

  private readonly cancelButton = viewChild<HTMLButtonElement>('cancelButton');

  constructor() {
    // Same reasoning as `DataErrorPage`: move focus to the safe option as soon as the destructive
    // step appears, so a stray keypress right after "Replace…" cannot also confirm it.
    effect(() => {
      if (this.confirmingReplace()) {
        this.cancelButton()?.focus();
      }
    });
  }

  protected startReplace(): void {
    this.confirmingReplace.set(true);
  }

  protected cancelReplace(): void {
    this.confirmingReplace.set(false);
  }

  protected confirmReplace(): void {
    this.dialogRef.close('replace');
  }

  protected exportFirst(): void {
    this.dialogRef.close('export-first');
  }
}
