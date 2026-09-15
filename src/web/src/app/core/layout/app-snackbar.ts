import type { ComponentType } from '@angular/cdk/portal';
import { EnvironmentInjector, Injectable, inject } from '@angular/core';
import type {
  MatSnackBar,
  MatSnackBarConfig,
  MatSnackBarRef,
  TextOnlySnackBar,
} from '@angular/material/snack-bar';

/** Panel class every app snackbar carries, so `styles.scss` can lift it above the bottom
 * navigation on handset widths instead of covering it (#128). */
export const APP_SNACKBAR_CLASS = 'app-snackbar';

/**
 * Opens this app's snackbars with `APP_SNACKBAR_CLASS`. Angular Material's snackbar (and the CDK
 * overlay under it) is loaded on first use rather than up front: snackbars only appear when
 * something has gone wrong, so they shouldn't add to every page's initial bundle. `preload()`
 * fetches it soon after startup, so an error that happens offline can still be shown.
 */
@Injectable({ providedIn: 'root' })
export class AppSnackbar {
  private readonly injector = inject(EnvironmentInjector);
  private snackBar: Promise<MatSnackBar> | undefined;

  async open(
    message: string,
    action: string,
    config: MatSnackBarConfig = {},
  ): Promise<MatSnackBarRef<TextOnlySnackBar>> {
    return (await this.load()).open(message, action, this.withAppClass(config));
  }

  async openFromComponent<T, D>(
    component: ComponentType<T>,
    config: MatSnackBarConfig<D>,
  ): Promise<MatSnackBarRef<T>> {
    return (await this.load()).openFromComponent(component, this.withAppClass(config));
  }

  /** Starts loading the snackbar code in the background, so a snackbar can still open later if
   * the network is gone by then. Safe to call repeatedly; a failed load is retried on next use. */
  preload(): void {
    this.load().catch(() => undefined);
  }

  private load(): Promise<MatSnackBar> {
    this.snackBar ??= import('@angular/material/snack-bar').then(
      (module) => this.injector.get(module.MatSnackBar),
      (error: unknown) => {
        this.snackBar = undefined;
        throw error;
      },
    );
    return this.snackBar;
  }

  private withAppClass<D>(config: MatSnackBarConfig<D>): MatSnackBarConfig<D> {
    return { ...config, panelClass: APP_SNACKBAR_CLASS };
  }
}
