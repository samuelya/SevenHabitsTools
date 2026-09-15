import { Injectable, Injector, effect, inject } from '@angular/core';
import { WINDOW } from '../../browser/window';
import { WriterLockService } from './writer-lock.service';

/**
 * A tab that was confirmed read-only and later acquires the write lock (because the previous
 * writer's tab closed) reloads the page, rather than trying to resume mid-session: it may hold a
 * stale in-memory document from before the other tab's last save, and a full reload re-runs
 * bootstrap against whatever is actually stored instead of risking an overwrite with stale data.
 *
 * It reacts only to the lock's latched `promoted` signal, which `WriterRoleState` sets on a
 * `reader → writer` transition and never on an initial grant, however slow (#125). So there is no
 * timing guess here, and at most one reload per page load.
 */
@Injectable({ providedIn: 'root' })
export class WriterPromotionReload {
  private readonly promoted = inject(WriterLockService).promoted;
  private readonly window = inject(WINDOW);
  private readonly injector = inject(Injector);

  private started = false;
  private reloaded = false;

  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;

    effect(
      () => {
        if (this.promoted() && !this.reloaded) {
          this.reloaded = true;
          this.window.location.reload();
        }
      },
      { injector: this.injector },
    );
  }
}
