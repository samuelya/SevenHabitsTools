import { Injectable, inject } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs';
import { WINDOW } from '../browser/window';
import { DocumentPersistence } from '../data/document-persistence';
import { Labels } from '../i18n/labels';
import { AppSnackbar } from '../layout/app-snackbar';

/**
 * Tells the user when a new build is ready (`SwUpdate.versionUpdates`) or the running app is
 * broken beyond in-place recovery (`SwUpdate.unrecoverable`), and reloads to pick it up — but only
 * once `DocumentPersistence` confirms nothing would be lost, flushing first so a debounced edit
 * isn't silently dropped (#136 is the same guard, for the "close tab" case rather than "update").
 * Owns exactly that decision; `InstallPromptService`/`PwaInstallBanner` are the separate install
 * flow, and the snackbar UI itself is `AppSnackbar`'s.
 */
@Injectable({ providedIn: 'root' })
export class AppUpdateService {
  private readonly swUpdate = inject(SwUpdate);
  private readonly persistence = inject(DocumentPersistence);
  private readonly window = inject(WINDOW);
  private readonly snackbar = inject(AppSnackbar);
  private readonly labels = inject(Labels);

  private started = false;
  private promptOpen = false;

  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    if (!this.swUpdate.isEnabled) {
      // No service worker in this context (dev server, or an unsupported browser): nothing to
      // watch for.
      return;
    }

    this.swUpdate.versionUpdates
      .pipe(filter((event): event is VersionReadyEvent => event.type === 'VERSION_READY'))
      .subscribe(() => this.notify('data.pwa.updateAvailable'));

    this.swUpdate.unrecoverable.subscribe(() => this.notify('data.pwa.updateRequired'));
  }

  private notify(messageKey: string): void {
    if (this.promptOpen) {
      return;
    }
    this.promptOpen = true;
    void this.showPrompt(messageKey);
  }

  private async showPrompt(messageKey: string): Promise<void> {
    try {
      const ref = await this.snackbar.open(
        this.labels.text(messageKey),
        this.labels.text('data.pwa.reload'),
      );
      ref.onAction().subscribe(() => void this.onReloadClicked(messageKey));
      ref.afterDismissed().subscribe(() => {
        this.promptOpen = false;
      });
    } catch {
      // Couldn't open it (e.g. the snackbar code failed to load): the next update event tries again.
      this.promptOpen = false;
    }
  }

  private async onReloadClicked(messageKey: string): Promise<void> {
    await this.persistence.flush();
    if (this.persistence.dirty() || this.persistence.saveError() !== null) {
      // Still unsafe to reload (an edit is mid-save, or saving keeps failing — SaveErrorNotifier
      // already tells the user why): reopen the prompt instead of silently dropping the pending
      // update, so "Reload" is there again once that resolves.
      this.notify(messageKey);
      return;
    }
    await this.swUpdate.activateUpdate().catch(() => undefined);
    this.window.location.reload();
  }
}
