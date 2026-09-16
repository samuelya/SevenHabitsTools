import { Injectable, Injector, effect, inject, untracked } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { WINDOW } from '../../browser/window';
import { AppSnackbar } from '../../layout/app-snackbar';
import { DocumentPersistence } from '../document-persistence';
import { IndexedDbAdapter } from './indexeddb-adapter';

/**
 * Tells the user to reload once another tab has opened a newer IndexedDB `DB_VERSION`
 * (`IndexedDbAdapter.connectionSuperseded`, from `onversionchange`, #139): this tab's connection
 * is already closed and can never reopen at its own, now-stale version, so it would otherwise keep
 * running against a document it can no longer save. Flushes any pending edit through
 * `DocumentPersistence` before reloading — the same guard `AppUpdateService` uses for a
 * service-worker update — a failed flush still surfaces through `SaveErrorNotifier`, so nothing is
 * lost silently.
 *
 * `IndexedDbAdapter` is injected optionally: `DocumentSync` (which starts this alongside every
 * other document-dependent service) must stay usable with any `StorageAdapter`, not just this one,
 * so a run without a real `IndexedDbAdapter` in the injector — a test, or a future adapter kind —
 * simply has nothing to watch instead of failing to construct.
 */
@Injectable({ providedIn: 'root' })
export class IndexedDbUpgradeNotifier {
  private readonly adapter = inject(IndexedDbAdapter, { optional: true });
  private readonly persistence = inject(DocumentPersistence);
  private readonly window = inject(WINDOW);
  private readonly snackbar = inject(AppSnackbar);
  private readonly transloco = inject(TranslocoService);
  private readonly injector = inject(Injector);

  private started = false;

  start(): void {
    if (this.started || !this.adapter) {
      return;
    }
    this.started = true;
    const adapter = this.adapter;

    let seen = untracked(adapter.connectionSuperseded);
    effect(
      () => {
        const count = adapter.connectionSuperseded();
        if (count > seen) {
          untracked(() => void this.showPrompt());
        }
        seen = count;
      },
      { injector: this.injector },
    );
  }

  private async showPrompt(): Promise<void> {
    try {
      const ref = await this.snackbar.open(
        this.transloco.translate('data.indexedDb.reloadRequired'),
        this.transloco.translate('data.pwa.reload'),
      );
      ref.onAction().subscribe(() => void this.onReloadClicked());
    } catch {
      // Couldn't open it (e.g. the snackbar code failed to load): this tab is still superseded,
      // but there's nothing more to do until the user reloads it some other way.
    }
  }

  private async onReloadClicked(): Promise<void> {
    await this.persistence.flush().catch(() => undefined);
    this.window.location.reload();
  }
}
