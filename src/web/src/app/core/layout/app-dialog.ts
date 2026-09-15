import type { ComponentType } from '@angular/cdk/portal';
import { EnvironmentInjector, Injectable, inject } from '@angular/core';
import type { MatDialog, MatDialogConfig, MatDialogRef } from '@angular/material/dialog';

/**
 * Opens this app's dialogs. Angular Material's dialog (and the CDK overlay under it) is loaded on
 * first use rather than up front, the same reasoning as `AppSnackbar`: a dialog (e.g. the JSON
 * import confirmation) is only needed for an occasional, deliberate action, so it shouldn't add to
 * every page's initial bundle.
 */
@Injectable({ providedIn: 'root' })
export class AppDialog {
  private readonly injector = inject(EnvironmentInjector);
  private matDialog: Promise<MatDialog> | undefined;

  async open<T, D = unknown, R = unknown>(
    component: ComponentType<T>,
    config: MatDialogConfig<D> = {},
  ): Promise<MatDialogRef<T, R>> {
    return (await this.load()).open(component, config);
  }

  private load(): Promise<MatDialog> {
    this.matDialog ??= import('@angular/material/dialog').then(
      (module) => this.injector.get(module.MatDialog),
      (error: unknown) => {
        this.matDialog = undefined;
        throw error;
      },
    );
    return this.matDialog;
  }
}
