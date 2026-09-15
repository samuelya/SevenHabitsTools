import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_SNACK_BAR_DATA,
  MatSnackBarAction,
  MatSnackBarActions,
  MatSnackBarLabel,
  MatSnackBarRef,
} from '@angular/material/snack-bar';

export interface SaveErrorSnackbarData {
  readonly message: string;
  readonly exportLabel: string;
  readonly dismissLabel: string;
}

/**
 * Snackbar content for a failed save: the message, "Export now" (reported to the opener as the
 * snackbar's action) and "Dismiss" (#128), since a plain `MatSnackBar.open()` allows only one
 * action. It only renders `data` and closes its own snackbar; what "export" does is the opener's
 * business (`SaveErrorNotifier`).
 */
@Component({
  selector: 'app-save-error-snackbar',
  imports: [MatButtonModule, MatSnackBarLabel, MatSnackBarActions, MatSnackBarAction],
  template: `
    <div matSnackBarLabel>{{ data.message }}</div>
    <div matSnackBarActions>
      <button mat-button matSnackBarAction type="button" (click)="ref.dismissWithAction()">
        {{ data.exportLabel }}
      </button>
      <button mat-button matSnackBarAction type="button" (click)="ref.dismiss()">
        {{ data.dismissLabel }}
      </button>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SaveErrorSnackbar {
  protected readonly data = inject<SaveErrorSnackbarData>(MAT_SNACK_BAR_DATA);
  protected readonly ref = inject<MatSnackBarRef<SaveErrorSnackbar>>(MatSnackBarRef);
}
