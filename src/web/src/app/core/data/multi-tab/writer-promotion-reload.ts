import { Injectable, Injector, effect, inject } from '@angular/core';
import { WINDOW } from '../../browser/window';
import { WRITER_LOCK } from './writer-lock';

/**
 * A tab that starts read-only and later acquires the write lock (because the previous writer's
 * tab closed) reloads the page, rather than trying to resume mid-session: it may hold a stale
 * in-memory document from before the other tab's last save, and a full reload re-runs bootstrap
 * against whatever is actually stored instead of risking an overwrite with stale data. A tab that
 * is already the writer when this starts does nothing — only a `false → true` transition reloads.
 */
@Injectable({ providedIn: 'root' })
export class WriterPromotionReload {
  private readonly writerLock = inject(WRITER_LOCK);
  private readonly window = inject(WINDOW);
  private readonly injector = inject(Injector);

  private started = false;
  private wasWriter: boolean | null = null;

  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;

    effect(
      () => {
        const isWriter = this.writerLock.isWriter();
        if (this.wasWriter === false && isWriter) {
          this.window.location.reload();
        }
        this.wasWriter = isWriter;
      },
      { injector: this.injector },
    );
  }
}
